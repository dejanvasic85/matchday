// Persists a Coastal league crawl: every fixture's clock-derived state and score, then the ladder
// recomputed from the completed matches. Every step is an upsert keyed on an `external_ref` or a
// `(league, team)` pair, so re-running at the same time overwrites with identical values.

import {
  externalRefEntityTypeValue,
  generateId,
  ok,
  serverError,
  sourceValue,
  type CompetitionId,
  type LeagueId,
  type Logger,
  type Result,
  type SeasonId,
  type TeamId,
} from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "#crawlers/externalRefEntityResolver.ts";
import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { buildLadder } from "#crawlers/coastal/ladder.ts";
import { resolveCoastalRosterTeams } from "#crawlers/coastal/rosterPersistence.ts";
import type { CoastalFixture, CoastalSeason } from "#crawlers/coastal/schemas.ts";
import { coastalFixtureSourceId } from "#crawlers/coastal/sourceIds.ts";

export type PersistLeagueSeasonSummary = {
  fixtures: number;
  tableEntries: number;
};

export type PersistLeagueSeasonInput = {
  competitionId: CompetitionId;
  seasonId: SeasonId;
  leagueId: LeagueId;
  season: CoastalSeason;
};

type LeagueSeasonContext = Omit<PersistLeagueSeasonInput, "season">;

function requireTeam(teamIdByClubKey: Map<string, TeamId>, clubKey: string): Result<TeamId> {
  const teamId = teamIdByClubKey.get(clubKey);
  return teamId === undefined ? serverError(`Club "${clubKey}" is not in the roster`) : ok(teamId);
}

async function persistFixtureResults(
  deps: EntityResolutionDeps,
  context: LeagueSeasonContext,
  fixtures: CoastalFixture[],
  teamIdByClubKey: Map<string, TeamId>,
): Promise<Result<void>> {
  for (const fixture of fixtures) {
    const homeTeamId = requireTeam(teamIdByClubKey, fixture.homeClubKey);
    const awayTeamId = requireTeam(teamIdByClubKey, fixture.awayClubKey);
    if (!homeTeamId.ok) {
      return homeTeamId;
    }
    if (!awayTeamId.ok) {
      return awayTeamId;
    }

    const persisted = await resolveEntityByExternalRef({
      deps,
      entityType: externalRefEntityTypeValue.fixture,
      source: sourceValue.coastal,
      sourceId: coastalFixtureSourceId(fixture),
      upsertEntity: (id) =>
        deps.upsertFixture({
          id,
          leagueId: context.leagueId,
          competitionId: context.competitionId,
          seasonId: context.seasonId,
          round: fixture.round,
          homeTeamId: homeTeamId.value,
          awayTeamId: awayTeamId.value,
          venue: fixture.venue,
          latitude: null,
          longitude: null,
          kickoffAt: fixture.kickoffAt,
          status: fixture.status,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          isBye: false,
        }),
    });
    if (!persisted.ok) {
      return persisted;
    }
  }
  return ok(undefined);
}

/** Recompute the ladder and upsert one row per club, plus its membership. Returns the row count. */
async function persistLadder(
  deps: EntityResolutionDeps,
  context: LeagueSeasonContext,
  fixtures: CoastalFixture[],
  teamIdByClubKey: Map<string, TeamId>,
): Promise<Result<number>> {
  const ladder = buildLadder(fixtures);
  for (const row of ladder) {
    const teamId = requireTeam(teamIdByClubKey, row.clubKey);
    if (!teamId.ok) {
      return teamId;
    }

    const entry = await deps.upsertTableEntry({
      id: generateId("tableEntry"),
      leagueId: context.leagueId,
      competitionId: context.competitionId,
      seasonId: context.seasonId,
      teamId: teamId.value,
      position: row.position,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
    });
    if (!entry.ok) {
      return entry;
    }

    const membership = await deps.upsertLeagueTeam({
      id: generateId("leagueTeam"),
      leagueId: context.leagueId,
      teamId: teamId.value,
    });
    if (!membership.ok) {
      return membership;
    }
  }
  return ok(ladder.length);
}

export async function persistLeagueSeason(
  deps: EntityResolutionDeps,
  logger: Logger,
  input: PersistLeagueSeasonInput,
  now: Date = new Date(),
): Promise<Result<PersistLeagueSeasonSummary>> {
  const { competitionId, seasonId, leagueId, season } = input;
  const context: LeagueSeasonContext = { competitionId, seasonId, leagueId };

  const teams = await resolveCoastalRosterTeams(deps);
  if (!teams.ok) {
    return teams;
  }

  const fixtures = generateSeasonFixtures(season, now);
  const results = await persistFixtureResults(deps, context, fixtures, teams.value);
  if (!results.ok) {
    return results;
  }

  const tableEntries = await persistLadder(deps, context, fixtures, teams.value);
  if (!tableEntries.ok) {
    return tableEntries;
  }

  logger.info("crawl.league.persisted", "persisted coastal league", {
    season: season.name,
    fixtures: fixtures.length,
    tableEntries: tableEntries.value,
  });

  return ok({ fixtures: fixtures.length, tableEntries: tableEntries.value });
}
