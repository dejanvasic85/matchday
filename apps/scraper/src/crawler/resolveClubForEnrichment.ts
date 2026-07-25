// Resolves a `list/clubs`/`clubs/{id}` source id to an *existing* club row for the club-enrichment
// job — mirrors resolveClub's identity-then-bridge steps but deliberately omits its third step
// ("brand new club"): enrichment attaches to clubs the deep crawl already discovered by
// `club_code`, never creates its own (ADR 0012). A club with no match (the ~11 admin
// pseudo-"clubs" that never appear on a table, per the Dribl identity investigation) resolves to
// `null`, which the caller skips rather than treating as an error.

import {
  err,
  externalRefEntityTypeValue,
  generateId,
  ok,
  parseId,
  sourceValue,
  type ClubId,
  type Result,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";

export type ResolveClubForEnrichmentInput = {
  deps: Pick<
    EntityResolutionDeps,
    "findClubByLogoUrl" | "findClubByName" | "findExternalRef" | "upsertExternalRef"
  >;
  sourceId: string;
  name: string;
  logoUrl: string | null;
};

function toClubId(id: string): Result<ClubId> {
  const clubId = parseId(id, "club");
  if (clubId === undefined) {
    return err({ message: `Club row id "${id}" doesn't have the expected "clb_" prefix` });
  }
  return ok(clubId);
}

export async function resolveClubForEnrichment(
  input: ResolveClubForEnrichmentInput,
): Promise<Result<ClubId | null>> {
  const { deps, sourceId, name, logoUrl } = input;

  // 1. A prior run already bridged this club — resolve directly.
  const existingRef = await deps.findExternalRef(sourceValue.dribl, sourceId);
  if (!existingRef.ok) {
    return existingRef;
  }
  if (existingRef.value !== null) {
    return toClubId(existingRef.value.internalId);
  }

  // 2. Bridge by logo, then name, against clubs the deep crawl already discovered.
  const byLogo = logoUrl !== null ? await deps.findClubByLogoUrl(logoUrl) : ok(null);
  if (!byLogo.ok) {
    return byLogo;
  }
  const bridgeMatch = byLogo.value === null ? await deps.findClubByName(name) : byLogo;
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }
  if (bridgeMatch.value === null) {
    // No match anywhere: never create (admin pseudo-clubs land here every run).
    return ok(null);
  }

  const clubId = toClubId(bridgeMatch.value.id);
  if (!clubId.ok) {
    return clubId;
  }

  // Persist the bridge so future runs hit step 1 directly, and so ADR 0004's "original Dribl URL
  // retained on the external_ref" requirement is satisfied for this club's logo.
  const refUpserted = await deps.upsertExternalRef({
    id: generateId("externalRef"),
    entityType: externalRefEntityTypeValue.club,
    internalId: clubId.value,
    source: sourceValue.dribl,
    sourceId,
    sourceUrl: logoUrl,
  });
  if (!refUpserted.ok) {
    return refUpserted;
  }

  return ok(clubId.value);
}
