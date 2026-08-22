// League overview (#163): one league page's data in one response — league, fixtures, table, teams.
// Composes the per-collection services rather than re-querying, so mapping stays in one place.

import { ok, type Result } from "@matchday/domain";
import type { Db } from "@matchday/db";
import {
  createFixtureServiceDeps,
  listLeagueFixtures,
  type FixtureResponse,
  type FixtureServiceDeps,
} from "#services/fixtureService.ts";
import {
  createLeagueServiceDeps,
  getLeague,
  type LeagueResponse,
  type LeagueServiceDeps,
} from "#services/leagueService.ts";
import {
  createTableEntryServiceDeps,
  listLeagueTable,
  type TableEntryResponse,
  type TableEntryServiceDeps,
} from "#services/tableEntryService.ts";
import {
  createTeamServiceDeps,
  listLeagueTeams,
  type TeamResponse,
  type TeamServiceDeps,
} from "#services/teamService.ts";

export type LeagueOverviewServiceDeps = Pick<LeagueServiceDeps, "getLeagueById"> &
  FixtureServiceDeps &
  TableEntryServiceDeps &
  Pick<TeamServiceDeps, "listTeamsByLeagueId">;

export function createLeagueOverviewServiceDeps(db: Db): LeagueOverviewServiceDeps {
  return {
    ...createLeagueServiceDeps(db),
    ...createFixtureServiceDeps(db),
    ...createTableEntryServiceDeps(db),
    ...createTeamServiceDeps(db),
  };
}

/** Spreads `LeagueResponse` deliberately: it's already the mapped wire shape, not a DB row, so a
 * new league field should flow through here too. */
export type LeagueOverviewResponse = LeagueResponse & {
  fixtures: FixtureResponse[];
  table: TableEntryResponse[];
  teams: TeamResponse[];
};

/** All four reads run concurrently — they're independent, and round-trips are what this endpoint
 * exists to remove. A missing league is a NotFound, never a 200 with empty collections. */
export async function getLeagueOverview(
  deps: LeagueOverviewServiceDeps,
  leagueId: string,
): Promise<Result<LeagueOverviewResponse>> {
  const [league, fixtures, table, teams] = await Promise.all([
    getLeague(deps, leagueId),
    listLeagueFixtures(deps, leagueId),
    listLeagueTable(deps, leagueId),
    listLeagueTeams(deps, leagueId),
  ]);

  if (!league.ok) {
    return league;
  }
  if (!fixtures.ok) {
    return fixtures;
  }
  if (!table.ok) {
    return table;
  }
  if (!teams.ok) {
    return teams;
  }

  return ok({
    ...league.value,
    fixtures: fixtures.value,
    table: table.value,
    teams: teams.value,
  });
}
