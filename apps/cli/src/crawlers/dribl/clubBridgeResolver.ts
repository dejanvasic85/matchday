// Bridges a name+logo pair to an existing club row — never creates one. Tries
// external_ref.sourceUrl (never rewritten) first, then club.logoUrl (overwritten to R2 on enrichment), then exact-name.

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
