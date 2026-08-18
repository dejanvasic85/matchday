// Bridges a name+logo pair to an *existing* club row — never creates one, never writes a ref.
// The shared lookup step behind resolveClub's step 2 (club_code identity, table entries),
// resolveClubForEnrichment (club-enrichment), and resolveTeamForFixture (fixture-only team
// discovery, which has no club_code to key identity on at all). Logo first: it's shared by every
// team of a club and unaffected by name suffixes (age group, grade, e.g. "Altona North SC U08"
// vs. the club row's "Altona North SC"); exact-name is the fallback for a club with no logo set.

import { ok, parseId, serverError, type ClubId, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type ClubBridgeDeps = Pick<EntityResolutionDeps, "findClubByLogoUrl" | "findClubByName">;

export async function findClubBridgeMatch(
  deps: ClubBridgeDeps,
  name: string,
  logoUrl: string | null,
): Promise<Result<ClubId | null>> {
  const byLogo = logoUrl !== null ? await deps.findClubByLogoUrl(logoUrl) : ok(null);
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
