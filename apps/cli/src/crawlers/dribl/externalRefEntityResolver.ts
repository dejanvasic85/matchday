// Find-or-create via external_ref, then always upsert the entity (fields like score/status change on re-crawl).
// external_ref is written before the entity row: no transaction (ADR 0011), so this order lets a partial failure self-heal on retry.

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
