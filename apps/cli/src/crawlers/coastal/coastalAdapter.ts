// The Coastal `SourceAdapter`. There is no site and no browser: the session generates the season
// from the clock, so `openSession` is a no-op and every crawl operation is a pure generator plus
// persistence. The catalog creates a season's structure and fixtures; the league crawl reveals
// results and the ladder.

import {
  externalRefEntityTypeValue,
  notFound,
  ok,
  parseId,
  serverError,
  sourceValue,
  todayInMelbourne,
  type CompetitionId,
  type Result,
  type SeasonId,
} from "@matchday/domain";
import { crawlSourceValue } from "#crawlers/constants.ts";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import { persistCatalogSeason } from "#crawlers/coastal/catalogPersistence.ts";
import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { persistLeagueSeason } from "#crawlers/coastal/leaguePersistence.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { seasonWindowForYear, seasonsToGenerate } from "#crawlers/coastal/seasonCalendar.ts";
import type { CoastalSeason } from "#crawlers/coastal/schemas.ts";
import { coastalSeasonNameFromSourceId } from "#crawlers/coastal/sourceIds.ts";
import type {
  CountCatalogLeaguesSummary,
  CrawlCatalogParams,
  CrawlCatalogSummary,
  CrawlClubEnrichmentSummary,
  CrawlLeagueParams,
  CrawlLeagueSummary,
  SourceAdapter,
  SourceSession,
} from "#crawlers/sourceAdapter.ts";

type CoastalLeagueContext = {
  season: CoastalSeason;
  competitionId: CompetitionId;
  seasonId: SeasonId;
};

const seasonYearFromName = (name: string): number | undefined => {
  const year = Number(name.slice(0, 4));
  return Number.isInteger(year) ? year : undefined;
};

/** Resolve the season a league belongs to. The league row gives the internal ids; the season's
 * external_ref gives the name, which carries the start year the calendar regenerates from. */
async function resolveLeagueContext(
  deps: EntityResolutionDeps,
  leagueId: string,
): Promise<Result<CoastalLeagueContext>> {
  const leagueRow = await deps.getLeagueById(leagueId);
  if (!leagueRow.ok) {
    return leagueRow;
  }
  if (leagueRow.value === null) {
    return notFound(`League "${leagueId}" not found`);
  }

  const competitionId = parseId(leagueRow.value.competitionId, "competition");
  const seasonId = parseId(leagueRow.value.seasonId, "season");
  if (competitionId === undefined || seasonId === undefined) {
    return serverError(`League "${leagueId}" has malformed competition/season ids`);
  }

  const seasonRef = await deps.findExternalRefByInternalId(
    externalRefEntityTypeValue.season,
    seasonId,
    sourceValue.coastal,
  );
  if (!seasonRef.ok) {
    return seasonRef;
  }
  if (seasonRef.value === null) {
    return serverError(`League "${leagueId}" has no coastal season external_ref`);
  }

  const name = coastalSeasonNameFromSourceId(seasonRef.value.sourceId);
  const year = name === undefined ? undefined : seasonYearFromName(name);
  if (name === undefined || year === undefined) {
    return serverError(`Coastal season ref "${seasonRef.value.sourceId}" carries no start year`);
  }

  return ok({ season: seasonWindowForYear(year), competitionId, seasonId });
}

async function runCatalogCrawl(params: CrawlCatalogParams): Promise<Result<CrawlCatalogSummary>> {
  const { deps, logger, dryRun } = params;
  const summary: CrawlCatalogSummary = {
    competitions: 0,
    leagues: 0,
    clubs: 0,
    teams: 0,
    tableEntries: 0,
  };

  for (const season of seasonsToGenerate(todayInMelbourne())) {
    if (dryRun) {
      logger.info("catalog.dryrun.season", "would persist coastal season", {
        season: season.name,
        startsOn: season.startsOn,
        endsOn: season.endsOn,
      });
      summary.competitions += 1;
      summary.leagues += 1;
      summary.clubs += coastalClubs.length;
      summary.teams += coastalClubs.length;
      continue;
    }

    const persisted = await persistCatalogSeason(deps, logger, season);
    if (!persisted.ok) {
      return persisted;
    }
    summary.competitions += persisted.value.competitions;
    summary.leagues += persisted.value.leagues;
    summary.clubs += persisted.value.clubs;
    summary.teams += persisted.value.teams;
  }

  return ok(summary);
}

async function runLeagueCrawl(params: CrawlLeagueParams): Promise<Result<CrawlLeagueSummary>> {
  const { deps, logger, leagueId, dryRun } = params;

  const context = await resolveLeagueContext(deps, leagueId);
  if (!context.ok) {
    return context;
  }

  if (dryRun) {
    const fixtures = generateSeasonFixtures(context.value.season, new Date());
    logger.info("crawlleagues.dryrun.league", "would persist coastal league results", {
      leagueId,
      season: context.value.season.name,
      fixtures: fixtures.length,
    });
    return ok({ fixtures: fixtures.length, tableEntries: coastalClubs.length });
  }

  return persistLeagueSeason(deps, logger, {
    competitionId: context.value.competitionId,
    seasonId: context.value.seasonId,
    leagueId,
    season: context.value.season,
  });
}

function runClubEnrichment(): Promise<Result<CrawlClubEnrichmentSummary>> {
  return Promise.resolve(ok({ listed: 0, updated: 0, skipped: 0 }));
}

export const coastalAdapter: SourceAdapter = {
  source: crawlSourceValue.coastal,
  async openSession() {
    const session: SourceSession = {
      crawlCatalog: (params) => runCatalogCrawl(params),
      countCatalogLeagues: () => Promise.resolve(ok<CountCatalogLeaguesSummary>({ total: 1 })),
      crawlLeague: (params) => runLeagueCrawl(params),
      crawlClubEnrichment: () => runClubEnrichment(),
      close: () => Promise.resolve(),
    };
    return ok(session);
  },
};
