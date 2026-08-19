// Bridges a name+logo pair to an existing club row — never creates one. Shared by resolveClub,
// resolveClubForEnrichment and resolveTeamForFixture. Logo URLs come from Dribl and never change,
// but club.logoUrl gets overwritten to an R2 URL once club-enrichment mirrors it (ADR 0004), so a
// Dribl logo seen elsewhere (e.g. a fixture) stops matching club.logoUrl from that point on.
// external_ref.sourceUrl retains the original Dribl URL and is never rewritten, so it's tried
// first; club.logoUrl still covers a club that hasn't been enrichment-mirrored yet; exact-name is
// the last resort for a club with no logo at all.

import { ok, parseId, serverError, type ClubId, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type ClubBridgeDeps = Pick<
  EntityResolutionDeps,
  "findClubByExternalRefSourceUrl" | "findClubByLogoUrl" | "findClubByName"
>;

export async function findClubBridgeMatch(
  deps: ClubBridgeDeps,
  name: string,
  logoUrl: string | null,
): Promise<Result<ClubId | null>> {
  const byRef = logoUrl !== null ? await deps.findClubByExternalRefSourceUrl(logoUrl) : ok(null);
  if (!byRef.ok) {
    return byRef;
  }
  const byLogo =
    byRef.value !== null || logoUrl === null ? byRef : await deps.findClubByLogoUrl(logoUrl);
  if (!byLogo.ok) {
    return byLogo;
  }
  const match = byLogo.value === null ? await deps.findClubByName(name) : byLogo;
  if (!match.ok) {
    return match;
  }
  if (match.value === null) {
    return ok(null);
  }

  const clubId = parseId(match.value.id, "club");
  if (clubId === undefined) {
    return serverError(`Club row id "${match.value.id}" doesn't have the expected "clb_" prefix`);
  }
  return ok(clubId);
}
