// Resolves a club by its Dribl `club_code`, the primary identity — logo/name matching
// is only a one-time bridge for pre-existing rows since logo is mutable and shared by pseudo-clubs.

import {
  externalRefEntityTypeValue,
  generateId,
  ok,
  parseId,
  serverError,
  sourceValue,
  type ClubId,
  type Result,
} from "@matchday/domain";
import { findClubBridgeMatch } from "#crawlers/dribl/clubBridgeResolver.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/dribl/externalRefEntityResolver.ts";

export type ResolveClubInput = {
  deps: Pick<
    EntityResolutionDeps,
    | "findClubByExternalRefSourceUrl"
    | "findClubByLogoUrl"
    | "findClubByName"
    | "findExternalRef"
    | "upsertExternalRef"
    | "upsertClub"
  >;
  name: string;
  logoUrl: string | null;
  clubCode: string;
};

function toClubId(id: string): Result<ClubId> {
  const clubId = parseId(id, "club");
  if (clubId === undefined) {
    return serverError(`Club row id "${id}" doesn't have the expected "clb_" prefix`);
  }
  return ok(clubId);
}

async function upsertClubRow(
  deps: Pick<EntityResolutionDeps, "upsertClub">,
  id: ClubId,
  name: string,
  logoUrl: string | null,
): Promise<Result<ClubId>> {
  const upserted = await deps.upsertClub({
    id,
    name,
    displayName: name,
    logoUrl,
    email: null,
    website: null,
    address: null,
    socials: null,
  });
  return upserted.ok ? ok(id) : upserted;
}

export async function resolveClub(input: ResolveClubInput): Promise<Result<ClubId>> {
  const { deps, name, logoUrl, clubCode } = input;

  // 1. Primary identity. Pass `null` logo so upsertClub's COALESCE never reverts an R2-mirrored
  // logo back to Dribl's CDN URL; backfill the ref's own sourceUrl once if left null previously.
  const existingRef = await deps.findExternalRef(sourceValue.driblClubCode, clubCode);
  if (!existingRef.ok) {
    return existingRef;
  }
  if (existingRef.value !== null) {
    const clubId = toClubId(existingRef.value.internalId);
    if (!clubId.ok) {
      return clubId;
    }
    if (existingRef.value.sourceUrl === null && logoUrl !== null) {
      const backfilled = await deps.upsertExternalRef({
        id: generateId("externalRef"),
        entityType: externalRefEntityTypeValue.club,
        internalId: clubId.value,
        source: sourceValue.driblClubCode,
        sourceId: clubCode,
        sourceUrl: logoUrl,
      });
      if (!backfilled.ok) {
        return backfilled;
      }
    }
    return upsertClubRow(deps, clubId.value, name, null);
  }

  // 2. Bridge: no ref yet — find a pre-existing row by logo, then name, and attach the ref so
  // every future crawl resolves it via step 1 directly instead of re-matching.
  const bridgeMatch = await findClubBridgeMatch(deps, name, logoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }

  if (bridgeMatch.value !== null) {
    const clubId = bridgeMatch.value;
    const refUpserted = await deps.upsertExternalRef({
      id: generateId("externalRef"),
      entityType: externalRefEntityTypeValue.club,
      internalId: clubId,
      source: sourceValue.driblClubCode,
      sourceId: clubCode,
      sourceUrl: logoUrl,
    });
    if (!refUpserted.ok) {
      return refUpserted;
    }
    return upsertClubRow(deps, clubId, name, logoUrl);
  }

  // 3. Brand new club: generate an id, write the ref, create the row.
  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.club,
    source: sourceValue.driblClubCode,
    sourceId: clubCode,
    sourceUrl: logoUrl ?? undefined,
    upsertEntity: (id) => upsertClubRow(deps, id, name, logoUrl),
  });
}
