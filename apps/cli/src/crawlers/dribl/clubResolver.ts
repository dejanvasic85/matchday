// Resolves a club by its Dribl `club_code` (ADR 0012): stable, unique, rebrand-safe, always
// present on table rows — the primary identity. Logo/name matching is demoted to a one-time
// bridge for clubs that predate this resolver (every club in the DB today, since no earlier code
// wrote a `dribl_club_code` ref) — it attaches the ref to the existing row instead of duplicating
// it. Once bridged (or created new), every future crawl hits the `external_ref` lookup directly.
// Per the ADR, logo is a join hint, not identity: it's mutable and shared by admin pseudo-clubs,
// so it must never be the primary key.

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
    "findClubByLogoUrl" | "findClubByName" | "findExternalRef" | "upsertExternalRef" | "upsertClub"
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

  // 1. Primary identity: has this club_code been seen before? Once a club is identity-resolved,
  // logo curation belongs to the club-enrichment job — pass `null` so upsertClub's COALESCE
  // leaves whatever it (or an earlier bridge/create) set alone, instead of reverting an
  // R2-mirrored logo back to Dribl's CDN URL on every subsequent deep crawl.
  const existingRef = await deps.findExternalRef(sourceValue.driblClubCode, clubCode);
  if (!existingRef.ok) {
    return existingRef;
  }
  if (existingRef.value !== null) {
    const clubId = toClubId(existingRef.value.internalId);
    if (!clubId.ok) {
      return clubId;
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
      sourceUrl: null,
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
    upsertEntity: (id) => upsertClubRow(deps, id, name, logoUrl),
  });
}
