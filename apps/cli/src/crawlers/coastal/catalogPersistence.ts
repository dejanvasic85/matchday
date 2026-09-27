// Persists a Coastal season's structure: competition, season, calendar window, league, the 20
// clubs and their teams and membership, and every fixture. Fixtures are created once, all
// scheduled — the league crawl owns their state after that, so a daily catalog run never clobbers
// a result.

import {
  externalRefEntityTypeValue,
  fixtureStatusValue,
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
import { coastalValue } from "#crawlers/coastal/constants.ts";
import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { resolveCoastalRosterTeams } from "#crawlers/coastal/rosterPersistence.ts";
import type { CoastalSeason } from "#crawlers/coastal/schemas.ts";
import {
  coastalCompetitionSourceId,
  coastalFixtureSourceId,
  coastalLeagueSourceId,
  coastalSeasonSourceId,
} from "#crawlers/coastal/sourceIds.ts";

export type PersistCatalogSeasonSummary = {
  competitions: number;
  leagues: number;
  clubs: number;
  teams: number;
  fixturesCreated: number;
};

type CatalogStructure = {
  competitionId: CompetitionId;
  seasonId: SeasonId;
  leagueId: LeagueId;
};

/** Find-or-create the competition, season and league, and ensure the season's calendar window. */
async function resolveCatalogStructure(
  deps: EntityResolutionDeps,
  season: CoastalSeason,
): Promise<Result<CatalogStructure>> {
  const competitionResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.competition,
    source: sourceValue.coastal,
    sourceId: coastalCompetitionSourceId,
    upsertEntity: (id) => deps.upsertCompetition({ id, name: coastalValue.competitionName }),
  });
  if (!competitionResult.ok) {
    return competitionResult;
  }

  const seasonResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.season,
    source: sourceValue.coastal,
    sourceId: coastalSeasonSourceId(season),
    upsertEntity: (id) => deps.upsertSeason({ id, source: sourceValue.coastal, name: season.name }),
  });
  if (!seasonResult.ok) {
    return seasonResult;
  }

  // Coastal generates its own calendar, so it writes the window itself. `ensure` leaves an existing
  // window alone, so a re-crawl writes no row.
  const ensured = await deps.ensureCompetitionSeason({
    id: generateId("competitionSeason"),
    competitionId: competitionResult.value,
    seasonId: seasonResult.value,
    startsOn: season.startsOn,
    endsOn: season.endsOn,
  });
  if (!ensured.ok) {
    return ensured;
  }

  const leagueResult = await resolveEntityByExternalRef({
    deps,
    entityType: externalRefEntityTypeValue.league,
    source: sourceValue.coastal,
    sourceId: coastalLeagueSourceId(season),
    upsertEntity: (id) =>
      deps.upsertLeague({
        id,
        name: coastalValue.leagueName,
        competitionId: competitionResult.value,
        seasonId: seasonResult.value,
        hasTable: true,
      }),
  });
  if (!leagueResult.ok) {
    return leagueResult;
  }

  return ok({
    competitionId: competitionResult.value,
    seasonId: seasonResult.value,
    leagueId: leagueResult.value,
  });
}

async function persistMembership(
  deps: EntityResolutionDeps,
  leagueId: LeagueId,
  teamIdByClubKey: Map<string, TeamId>,
): Promise<Result<void>> {
  for (const teamId of teamIdByClubKey.values()) {
    const membership = await deps.upsertLeagueTeam({
      id: generateId("leagueTeam"),
      leagueId,
      teamId,
    });
    if (!membership.ok) {
      return membership;
    }
  }
  return ok(undefined);
}

/** Create a fixture for every scheduled match not already known. Returns how many it created. */
async function createScheduledFixtures(
  deps: EntityResolutionDeps,
  structure: CatalogStructure,
  season: CoastalSeason,
  teamIdByClubKey: Map<string, TeamId>,
  now: Date,
): Promise<Result<number>> {
  let created = 0;
  for (const fixture of generateSeasonFixtures(season, now)) {
    const existing = await deps.findExternalRef(
      sourceValue.coastal,
      coastalFixtureSourceId(fixture),
    );
    if (!existing.ok) {
      return existing;
    }
    if (existing.value !== null) {
      continue;
    }

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
          leagueId: structure.leagueId,
          competitionId: structure.competitionId,
          seasonId: structure.seasonId,
          round: fixture.round,
          homeTeamId,
          awayTeamId,
          venue: fixture.venue,
          latitude: null,
          longitude: null,
          kickoffAt: fixture.kickoffAt,
          status: fixtureStatusValue.scheduled,
          homeScore: null,
          awayScore: null,
          isBye: false,
        }),
    });
    if (!persisted.ok) {
      return persisted;
    }
    created += 1;
  }
  return ok(created);
}

export async function persistCatalogSeason(
  deps: EntityResolutionDeps,
  logger: Logger,
  season: CoastalSeason,
  now: Date = new Date(),
): Promise<Result<PersistCatalogSeasonSummary>> {
  const structure = await resolveCatalogStructure(deps, season);
  if (!structure.ok) {
    return structure;
  }

  const teams = await resolveCoastalRosterTeams(deps);
  if (!teams.ok) {
    return teams;
  }

  const membership = await persistMembership(deps, structure.value.leagueId, teams.value);
  if (!membership.ok) {
    return membership;
  }

  const fixturesCreated = await createScheduledFixtures(
    deps,
    structure.value,
    season,
    teams.value,
    now,
  );
  if (!fixturesCreated.ok) {
    return fixturesCreated;
  }

  logger.info("catalog.persist.season", "persisted coastal season", {
    season: season.name,
    clubs: teams.value.size,
    fixturesCreated: fixturesCreated.value,
  });

  return ok({
    competitions: 1,
    leagues: 1,
    clubs: teams.value.size,
    teams: teams.value.size,
    fixturesCreated: fixturesCreated.value,
  });
}
