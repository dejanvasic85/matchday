// Team resolution differs by caller: fixture data has a team name + Dribl team hash id but no
// club_code, so it can't resolve a club by identity the way resolveTeamForTableEntry does.
// It bridges instead — same logo-then-name match as resolveClub's own bridge step (see
// clubBridgeResolver) — using the team's logo, which Dribl sets to the *club's* logo on every
// fixture regardless of age group, so it survives team-name suffixes ("Altona North SC U08")
// that would defeat a name match. A team whose club can't be bridged yet (its club has never
// been seen elsewhere, e.g. a MiniRoos-only club) is still created unlinked (clubId: null)
// rather than blocked — resolveTeamForTableEntry links it later if this team's league ever
// produces a table, and this resolver retries the bridge on every subsequent sighting (self-
// healing once the club does show up, e.g. via a senior team's table entry).
// Table-entry data carries team name + club name together, so it's the one place that resolves
// (and can update) the club a team belongs to from source data alone.

import {
  externalRefEntityTypeValue,
  ok,
  parseId,
  serverError,
  sourceValue,
  type Result,
  type TeamId,
} from "@matchday/domain";
import { findClubBridgeMatch } from "#crawlers/dribl/clubBridgeResolver.ts";
import { resolveClub } from "#crawlers/dribl/clubResolver.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/dribl/externalRefEntityResolver.ts";

type ResolveTeamForFixtureDeps = Pick<
  EntityResolutionDeps,
  | "findClubByLogoUrl"
  | "findClubByName"
  | "findExternalRef"
  | "getTeamById"
  | "upsertExternalRef"
  | "upsertTeam"
>;

async function bridgeUnlinkedTeam(
  deps: ResolveTeamForFixtureDeps,
  teamId: TeamId,
  teamName: string,
  teamLogoUrl: string | null,
): Promise<Result<TeamId>> {
  const current = await deps.getTeamById(teamId);
  if (!current.ok) {
    return current;
  }
  if (current.value === null || current.value.clubId !== null) {
    return ok(teamId);
  }

  const bridgeMatch = await findClubBridgeMatch(deps, teamName, teamLogoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }
  if (bridgeMatch.value === null) {
    return ok(teamId);
  }

  const updated = await deps.upsertTeam({
    id: teamId,
    clubId: bridgeMatch.value,
    name: current.value.name,
    ageGroup: current.value.ageGroup,
    gender: current.value.gender,
  });
  return updated.ok ? ok(teamId) : updated;
}

export async function resolveTeamForFixture(
  deps: ResolveTeamForFixtureDeps,
  teamSourceId: string,
  teamName: string,
  teamLogoUrl: string | null,
): Promise<Result<TeamId>> {
  const existing = await deps.findExternalRef(sourceValue.dribl, teamSourceId);
  if (!existing.ok) {
    return existing;
  }
  if (existing.value !== null) {
    const teamId = parseId(existing.value.internalId, "team");
    if (teamId === undefined) {
      return serverError(
        `external_ref internalId "${existing.value.internalId}" doesn't match expected prefix for "team"`,
      );
    }
    return bridgeUnlinkedTeam(deps, teamId, teamName, teamLogoUrl);
  }

  const bridgeMatch = await findClubBridgeMatch(deps, teamName, teamLogoUrl);
  if (!bridgeMatch.ok) {
    return bridgeMatch;
  }

  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    sourceId: teamSourceId,
    upsertEntity: (id) =>
      deps.upsertTeam({
        id,
        clubId: bridgeMatch.value,
        name: teamName,
        ageGroup: null,
        gender: null,
      }),
  });
}

export type ResolveTeamForTableEntryInput = {
  deps: EntityResolutionDeps;
  teamSourceId: string;
  teamName: string;
  clubName: string;
  clubLogoUrl: string | null;
  clubCode: string;
};

export async function resolveTeamForTableEntry(
  input: ResolveTeamForTableEntryInput,
): Promise<Result<TeamId>> {
  const { deps, teamSourceId, teamName, clubName, clubLogoUrl, clubCode } = input;

  const clubResult = await resolveClub({ deps, name: clubName, logoUrl: clubLogoUrl, clubCode });
  if (!clubResult.ok) {
    return clubResult;
  }
  const clubId = clubResult.value;

  return resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    sourceId: teamSourceId,
    upsertEntity: (id) =>
      deps.upsertTeam({
        id,
        clubId,
        name: teamName,
        ageGroup: null,
        gender: null,
      }),
  });
}
