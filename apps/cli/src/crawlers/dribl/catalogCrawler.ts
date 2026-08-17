// Catalog crawl (0012): resolves the tenant + season, walks every competition and, for each,
// up to `maxLeagues` of its leagues (all leagues when unset), fetching each league's table
// (teams + club info). `maxLeagues` lets a caller keep the crawl cheap while iterating on the
// pipeline — e.g. `mday catalog --max-leagues 1` crawls one league per competition instead of
// the full source.
//
// Some leagues (e.g. MiniRoos junior age groups) have no table at all, so a table-less league
// falls back to a few rounds of fixtures to discover its teams instead (discoverTeamsFromFixtures)
// — otherwise those teams would never enter the catalog for Sanity's onboarding dropdowns to find.
//
// An optional `onLeague` callback is invoked with each league the moment it's crawled, so the job
// can persist it immediately rather than buffering the whole catalog and writing at the end (a DB
// failure then aborts early with the leagues so far already committed). If it returns `err`, the
// crawl stops and surfaces that error. Every crawled league is also returned, so callers that just
// want the data (dry runs, tests) can ignore `onLeague`.

import { notFound, ok, serverError, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { crawlerConfigValue } from "#crawlers/dribl/constants.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import { driblFixturesApiResponseSchema } from "#crawlers/dribl/external/driblFixture.ts";
import { driblTableApiResponseSchema } from "#crawlers/dribl/external/driblTableEntry.ts";
import {
  listCompetitions,
  listLeagues,
  listSeasons,
  resolveTenantId,
} from "#crawlers/dribl/driblCatalogApi.ts";
import { mapDriblFixture } from "#crawlers/dribl/mappers/mapDriblFixture.ts";
import {
  mapDriblTableEntry,
  type MappedTableEntry,
} from "#crawlers/dribl/mappers/mapDriblTableEntry.ts";

export type CatalogFixtureTeam = {
  sourceId: string;
  name: string;
};

/** Discovers teams from a few rounds of fixtures — the fallback for a league with no table (see
 * file header). Dedupes by team source id since the same team appears across multiple rounds. */
async function discoverTeamsFromFixtures(
  page: FetchPage,
  ids: DriblLeagueIds,
): Promise<Result<CatalogFixtureTeam[]>> {
  const teamsBySourceId = new Map<string, string>();

  for (let round = 1; round <= crawlerConfigValue.catalogFixtureFallbackRounds; round++) {
    const url = buildDriblApiUrl("fixtures", ids, { round: String(round) });
    const fetched = await browserFetch(page, url);
    if (!fetched.ok) {
      return fetched;
    }

    const parsed = driblFixturesApiResponseSchema.safeParse(fetched.value);
    if (!parsed.success) {
      return serverError(`Failed to validate fixtures response for round ${round}`, parsed.error);
    }

    for (const fixture of parsed.data.data) {
      const mapped = mapDriblFixture(fixture);
      if (mapped.homeTeamSourceId !== null && mapped.homeTeamName !== null) {
        teamsBySourceId.set(mapped.homeTeamSourceId, mapped.homeTeamName);
      }
      if (mapped.awayTeamSourceId !== null && mapped.awayTeamName !== null) {
        teamsBySourceId.set(mapped.awayTeamSourceId, mapped.awayTeamName);
      }
    }
  }

  return ok([...teamsBySourceId.entries()].map(([sourceId, name]) => ({ sourceId, name })));
}

export type CrawlCatalogInput = {
  page: FetchPage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
  /** Crawl at most this many leagues per competition. Unset crawls every league. */
  maxLeagues?: number;
  /** Invoked with each league as it's crawled; return `err` to abort the crawl. */
  onLeague?: (league: CrawlCatalogLeagueResult) => Promise<Result<unknown>>;
};

export type CrawlCatalogLeagueResult = {
  competitionSourceId: string;
  competitionName: string;
  leagueSourceId: string;
  leagueName: string;
  seasonSourceId: string;
  seasonName: string;
  tableEntries: MappedTableEntry[];
  /** Teams discovered from fixtures instead — only populated when this league has no table. */
  fixtureTeams: CatalogFixtureTeam[];
};

export async function crawlCatalog(
  input: CrawlCatalogInput,
): Promise<Result<CrawlCatalogLeagueResult[]>> {
  const { page, logger, tenantHost, tenantSlug, seasonYear, maxLeagues, onLeague } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  const tenantId = tenantResult.value;
  logger.info("catalog.tenant", "resolved tenant", { tenantId });

  const seasonsResult = await listSeasons(page, tenantId);
  if (!seasonsResult.ok) {
    return seasonsResult;
  }
  const season = seasonsResult.value.find((item) => item.attributes.name === seasonYear);
  if (season === undefined) {
    return notFound(`No season found matching "${seasonYear}"`);
  }

  const competitionsResult = await listCompetitions(page, tenantId);
  if (!competitionsResult.ok) {
    return competitionsResult;
  }
  logger.info("catalog.competitions", "listed competitions", {
    total: competitionsResult.value.length,
  });

  const results: CrawlCatalogLeagueResult[] = [];

  for (const competition of competitionsResult.value) {
    const leaguesResult = await listLeagues(page, tenantId, competition.id);
    if (!leaguesResult.ok) {
      return leaguesResult;
    }
    const leagues = leaguesResult.value.slice(0, maxLeagues);
    logger.info("catalog.leagues", "listed leagues for competition", {
      competition: competition.attributes.name,
      total: leaguesResult.value.length,
      crawling: leagues.length,
    });

    for (const league of leagues) {
      const ids = {
        season: season.id,
        competition: competition.id,
        league: league.id,
        tenant: tenantId,
      };
      const tableUrl = buildDriblApiUrl("ladders", ids);
      const tableFetched = await browserFetch(page, tableUrl);
      if (!tableFetched.ok) {
        return tableFetched;
      }

      const tableParsed = driblTableApiResponseSchema.safeParse(tableFetched.value);
      if (!tableParsed.success) {
        return serverError("Failed to validate table response", tableParsed.error);
      }

      const tableEntries = tableParsed.data.data.map(mapDriblTableEntry);
      logger.info("catalog.table", "fetched league table", {
        competition: competition.attributes.name,
        league: league.attributes.name,
        entries: tableEntries.length,
      });

      let fixtureTeams: CatalogFixtureTeam[] = [];
      if (tableEntries.length === 0) {
        const fixtureTeamsResult = await discoverTeamsFromFixtures(page, ids);
        if (!fixtureTeamsResult.ok) {
          return fixtureTeamsResult;
        }
        fixtureTeams = fixtureTeamsResult.value;
        logger.info("catalog.fixtureFallback", "no table; discovered teams from fixtures", {
          competition: competition.attributes.name,
          league: league.attributes.name,
          teams: fixtureTeams.length,
        });
      }

      const crawledLeague: CrawlCatalogLeagueResult = {
        competitionSourceId: competition.id,
        competitionName: competition.attributes.name,
        leagueSourceId: league.id,
        leagueName: league.attributes.name,
        seasonSourceId: season.id,
        seasonName: season.attributes.name,
        tableEntries,
        fixtureTeams,
      };
      results.push(crawledLeague);

      if (onLeague !== undefined) {
        const persisted = await onLeague(crawledLeague);
        if (!persisted.ok) {
          return persisted;
        }
      }
    }
  }

  return ok(results);
}
