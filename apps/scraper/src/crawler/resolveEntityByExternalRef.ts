// Shared "find or create, then always upsert" pattern behind club/team/fixture resolution: look
// up the entity via its external_ref(source, sourceId) to find (or generate) its internal id,
// then upsert the entity row either way — a re-crawl must refresh fields that change over time
// (a fixture's score/status, for instance), not just create-once-and-skip. No interactive
// transactions available over neon-http (ADR 0011) — each step is itself idempotent (a lookup
// or an upsert), so a partial failure is safe to retry on the next crawl.

import {
  err,
  generateId,
  ok,
  parseId,
  sourceValue,
  type EntityId,
  type EntityType,
  type ExternalRefEntityType,
  type Result,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";

export type ResolveEntityByExternalRefInput<T extends EntityType & ExternalRefEntityType> = {
  deps: Pick<EntityResolutionDeps, "findExternalRef" | "upsertExternalRef">;
  entityType: T;
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

  const existing = await deps.findExternalRef(sourceValue.dribl, sourceId);
  if (!existing.ok) {
    return existing;
  }

  let id: EntityId<T>;
  let isNew: boolean;
  if (existing.value !== null) {
    const internalId = parseId(existing.value.internalId, entityType);
    if (internalId === undefined) {
      return err({
        message: `external_ref internalId "${existing.value.internalId}" doesn't match expected prefix for "${entityType}"`,
      });
    }
    id = internalId;
    isNew = false;
  } else {
    id = generateId(entityType);
    isNew = true;
  }

  const upserted = await upsertEntity(id);
  if (!upserted.ok) {
    return upserted;
  }

  if (isNew) {
    const refUpserted = await deps.upsertExternalRef({
      id: generateId("externalRef"),
      entityType,
      internalId: id,
      source: sourceValue.dribl,
      sourceId,
      sourceUrl: sourceUrl ?? null,
    });
    if (!refUpserted.ok) {
      return refUpserted;
    }
  }

  return ok(id);
}
