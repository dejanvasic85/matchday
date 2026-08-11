// Shared "find or create, then always upsert" pattern behind club/team/fixture resolution: look
// up the entity via its external_ref(source, sourceId) to find (or generate) its internal id,
// then upsert the entity row either way — a re-crawl must refresh fields that change over time
// (a fixture's score/status, for instance), not just create-once-and-skip. No interactive
// transactions available over neon-http (ADR 0011) — each step is itself idempotent (a lookup
// or an upsert), so a partial failure is safe to retry on the next crawl.
//
// For a *new* entity the external_ref is written *before* the entity row. There's no transaction,
// so if the second write fails we're left with a partial state either way — but with the ref
// written first, the orphan is a ref pointing at a not-yet-existing entity, which the next crawl
// self-heals: `findExternalRef` returns the same internal id and the entity upsert completes it.
// The reverse order (entity first) would instead orphan the entity — the next crawl wouldn't find
// its ref, would mint a *new* id, and would leave a duplicate row behind.

import {
  generateId,
  ok,
  parseId,
  serverError,
  sourceValue,
  type EntityId,
  type EntityType,
  type ExternalRefEntityType,
  type Result,
  type Source,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type ResolveEntityByExternalRefInput<T extends EntityType & ExternalRefEntityType> = {
  deps: Pick<EntityResolutionDeps, "findExternalRef" | "upsertExternalRef">;
  entityType: T;
  /** Identity source for the ref (default `dribl`) — e.g. `dribl_club_code` for club identity. */
  source?: Source;
  sourceId: string;
  sourceUrl?: string;
  /** Upsert the entity row with the given (found-or-generated) id. */
  upsertEntity: (id: EntityId<T>) => Promise<Result<unknown>>;
};

/** Resolve `sourceId`'s internal entity id, upserting the entity + external_ref each call. */
export async function resolveEntityByExternalRef<T extends EntityType & ExternalRefEntityType>(
  input: ResolveEntityByExternalRefInput<T>,
): Promise<Result<EntityId<T>>> {
  const { deps, entityType, sourceId, sourceUrl, upsertEntity } = input;
  const source = input.source ?? sourceValue.dribl;

  const existing = await deps.findExternalRef(source, sourceId);
  if (!existing.ok) {
    return existing;
  }

  let id: EntityId<T>;
  let isNew: boolean;
  if (existing.value !== null) {
    const internalId = parseId(existing.value.internalId, entityType);
    if (internalId === undefined) {
      return serverError(
        `external_ref internalId "${existing.value.internalId}" doesn't match expected prefix for "${entityType}"`,
      );
    }
    id = internalId;
    isNew = false;
  } else {
    id = generateId(entityType);
    isNew = true;
  }

  // Write the ref first for a new entity so a failure between the two writes self-heals on the
  // next crawl (see file header) rather than orphaning the entity into a duplicate.
  if (isNew) {
    const refUpserted = await deps.upsertExternalRef({
      id: generateId("externalRef"),
      entityType,
      internalId: id,
      source,
      sourceId,
      sourceUrl: sourceUrl ?? null,
    });
    if (!refUpserted.ok) {
      return refUpserted;
    }
  }

  const upserted = await upsertEntity(id);
  if (!upserted.ok) {
    return upserted;
  }

  return ok(id);
}
