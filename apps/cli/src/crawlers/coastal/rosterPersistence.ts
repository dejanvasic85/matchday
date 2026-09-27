// Find-or-create a Coastal club and its one team, keyed on the roster key. Idempotent, so the
// catalog and the league crawl can both call it: the club carries the ground, the team the club
// link, and each has its own external_ref.

import {
  externalRefEntityTypeValue,
  ok,
  sourceValue,
  type ClubId,
  type Result,
  type TeamId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/externalRefEntityResolver.ts";
import { coastalClubs, type CoastalClub } from "#crawlers/coastal/roster.ts";
import { coastalClubSourceId, coastalTeamSourceId } from "#crawlers/coastal/sourceIds.ts";

export type CoastalClubIds = {
  clubId: ClubId;
  teamId: TeamId;
};

export async function resolveCoastalClubAndTeam(
  deps: EntityResolutionDeps,
  club: CoastalClub,
): Promise<Result<CoastalClubIds>> {
  const clubResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.club,
    source: sourceValue.coastal,
    sourceId: coastalClubSourceId(club),
    upsertEntity: (id) =>
      deps.upsertClub({
        id,
        name: club.name,
        displayName: club.name,
        logoUrl: null,
        email: null,
        website: null,
        address: null,
        socials: null,
        grounds: { name: club.ground, address: null },
        color: null,
        accent: null,
        store: null,
      }),
  });
  if (!clubResult.ok) {
    return clubResult;
  }

  const teamResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.team,
    source: sourceValue.coastal,
    sourceId: coastalTeamSourceId(club),
    upsertEntity: (id) => deps.upsertTeam({ id, clubId: clubResult.value, name: club.teamName }),
  });
  if (!teamResult.ok) {
    return teamResult;
  }

  return ok({ clubId: clubResult.value, teamId: teamResult.value });
}

/** Resolve every roster club and its team to internal ids, keyed by the roster key. */
export async function resolveCoastalRosterTeams(
  deps: EntityResolutionDeps,
): Promise<Result<Map<string, TeamId>>> {
  const teamIdByClubKey = new Map<string, TeamId>();
  for (const club of coastalClubs) {
    const ids = await resolveCoastalClubAndTeam(deps, club);
    if (!ids.ok) {
      return ids;
    }
    teamIdByClubKey.set(club.key, ids.value.teamId);
  }
  return ok(teamIdByClubKey);
}
