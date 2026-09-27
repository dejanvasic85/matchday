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
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { resolveCoastalClubAndTeam } from "#crawlers/coastal/rosterPersistence.ts";
import type { CoastalSeason } from "#crawlers/coastal/schemas.ts";
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

export async function persistLeagueSeason(
  deps: EntityResolutionDeps,
  logger: Logger,
  input: PersistLeagueSeasonInput,
  now: Date = new Date(),
): Promise<Result<PersistLeagueSeasonSummary>> {
  const { competitionId, seasonId, leagueId, season } = input;

  const teamIdByClubKey = new Map<string, TeamId>();
  for (const club of coastalClubs) {
    const ids = await resolveCoastalClubAndTeam(deps, club);
    if (!ids.ok) {
      return ids;
    }
    teamIdByClubKey.set(club.key, ids.value.teamId);
  }

  const fixtures = generateSeasonFixtures(season, now);
  for (const fixture of fixtures) {
    const homeTeamId = teamIdByClubKey.get(fixture.homeClubKey);
    const awayTeamId = teamIdByClubKey.get(fixture.awayClubKey);
    if (homeTeamId === undefined || awayTeamId === undefined) {
      return serverError(`Fixture "${fixture.key}" names a club outside the roster`);
    }

    const persisted = await resolveEntityByExternalRef({
      deps,
      entityType: externalRefEntityTypeValue.fixture,
      source: sourceValue.coastal,
      sourceId: coastalFixtureSourceId(fixture),
      upsertEntity: (id) =>
        deps.upsertFixture({
          id,
          leagueId,
          competitionId,
          seasonId,
          round: fixture.round,
          homeTeamId,
          awayTeamId,
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

  const ladder = buildLadder(fixtures);
  for (const row of ladder) {
    const teamId = teamIdByClubKey.get(row.clubKey);
    if (teamId === undefined) {
      return serverError(`Ladder names a club outside the roster: "${row.clubKey}"`);
    }

    const entry = await deps.upsertTableEntry({
      id: generateId("tableEntry"),
      leagueId,
      competitionId,
      seasonId,
      teamId,
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
      leagueId,
      teamId,
    });
    if (!membership.ok) {
      return membership;
    }
  }

  logger.info("crawl.league.persisted", "persisted coastal league", {
    season: season.name,
    fixtures: fixtures.length,
    tableEntries: ladder.length,
  });

  return ok({ fixtures: fixtures.length, tableEntries: ladder.length });
}
