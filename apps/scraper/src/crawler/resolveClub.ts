// Resolves a club from table-entry data (club name + logo, no stable Dribl club id in this
// payload — only the clubs-sync job's api/list/clubs crawl has one, per Phase 3 todo). Matches
// an existing club by logo URL first (precise, avoids name collisions), falling back to name,
// creating a new club if neither matches. No external_ref is written here: when clubs-sync
// lands, it upserts by external_ref keyed on the real Dribl club id and should match by
// logo/name to attach that ref to this same row rather than creating a duplicate.
//
// Not safe against concurrent calls for the same new club (no DB unique constraint on
// name/logoUrl backs this lookup-then-insert) — fine while the crawl processes one league's
// table sequentially per run; would need a constraint + conflict handling if that changes.

import { err, generateId, ok, parseId, type ClubId, type Result } from "@matchday/domain";
import type { EntityResolutionDeps } from "./entityResolutionDeps.ts";

export type ResolveClubInput = {
  deps: Pick<EntityResolutionDeps, "findClubByLogoUrl" | "findClubByName" | "upsertClub">;
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

export async function resolveClub(input: ResolveClubInput): Promise<Result<ClubId>> {
  const { deps, name, logoUrl } = input;

  if (logoUrl !== null) {
    const byLogo = await deps.findClubByLogoUrl(logoUrl);
    if (!byLogo.ok) {
      return byLogo;
    }
    if (byLogo.value !== null) {
      return toClubId(byLogo.value.id);
    }
  }

  const byName = await deps.findClubByName(name);
  if (!byName.ok) {
    return byName;
  }
  if (byName.value !== null) {
    return toClubId(byName.value.id);
  }

  const id = generateId("club");
  const created = await deps.upsertClub({
    id,
    name,
    displayName: name,
    logoUrl,
    email: null,
    website: null,
    address: null,
    socials: null,
  });
  if (!created.ok) {
    return created;
  }

  return ok(id);
}
