// Bridges a name+logo pair to an existing club row — never creates one. Shared by resolveClub,
// resolveClubForEnrichment and resolveTeamForFixture. Logo first: shared club-wide, so it survives
// team-name suffixes (age group) that would defeat an exact-name match.

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
