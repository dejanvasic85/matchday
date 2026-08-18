// Catalog crawl (0012): resolves the tenant + season, then crawls a window of the flat
// (competition, league) queue every competition's leagues flatten into (listLeagueQueue),
// fetching each league's table (teams + club info). `maxLeagues` caps how many leagues per
// competition enter the queue at all — e.g. `mday catalog --max-leagues 1` for a cheap
// single-league-per-competition pass while iterating on the pipeline. `offset`/`limit` instead
// slice the (already-capped) queue itself — the crawl-catalog.yml matrix uses this to split one
// oversized serial crawl into many bounded parallel legs (countCatalogLeagues sizes the matrix;
// each leg gets its own offset/limit window). The two compose: maxLeagues shrinks the queue built
// per competition, offset/limit then windows the resulting flat list.
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
import type { DriblListItem } from "#crawlers/dribl/external/driblListEndpoints.ts";
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

type QueuedLeague = {
  competition: DriblListItem;
  league: DriblListItem;
};

/** Flattens every competition's (capped) leagues into one ordered queue — the cheap listing-only
 * pass shared by `crawlCatalog` and `countCatalogLeagues` (see file header).
 *
 * The crawl-catalog.yml matrix relies on this queue being in the *same order* across separate
 * calls: `countCatalogLeagues` builds it once in the setup job to size the matrix, then each
 * matrix leg independently rebuilds it (via `crawlCatalog`) just to slice its own offset/limit
 * window — nothing is passed between jobs but plain integers. This assumes Dribl's `list/*`
 * endpoints return a stable order within that few-minutes window. If that ever drifts, the worst
 * case is a league crawled twice or skipped for one run — harmless, since every write here is an
 * idempotent upsert by `external_ref` and self-heals on the next scheduled run. */
async function listLeagueQueue(
  page: FetchPage,
  logger: Logger,
  tenantId: string,
  maxLeagues: number | undefined,
): Promise<Result<QueuedLeague[]>> {
  const competitionsResult = await listCompetitions(page, tenantId);
  if (!competitionsResult.ok) {
    return competitionsResult;
  }
  logger.info("catalog.competitions", "listed competitions", {
    total: competitionsResult.value.length,
  });

  const queue: QueuedLeague[] = [];
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
      queue.push({ competition, league });
    }
  }
  return ok(queue);
}

export type CatalogFixtureTeam = {
  sourceId: string;
  name: string;
  /** The club's logo as seen on the fixture — resolveTeamForFixture's club-bridge signal. */
  logoUrl: string | null;
};

/** Discovers teams from a few rounds of fixtures — the fallback for a league with no table (see
 * file header). Dedupes by team source id since the same team appears across multiple rounds. */
async function discoverTeamsFromFixtures(
  page: FetchPage,
  ids: DriblLeagueIds,
): Promise<Result<CatalogFixtureTeam[]>> {
  const teamsBySourceId = new Map<string, { name: string; logoUrl: string | null }>();

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
        teamsBySourceId.set(mapped.homeTeamSourceId, {
          name: mapped.homeTeamName,
          logoUrl: mapped.homeTeamLogoUrl,
        });
      }
      if (mapped.awayTeamSourceId !== null && mapped.awayTeamName !== null) {
        teamsBySourceId.set(mapped.awayTeamSourceId, {
          name: mapped.awayTeamName,
          logoUrl: mapped.awayTeamLogoUrl,
        });
      }
    }
  }

  return ok(
    [...teamsBySourceId.entries()].map(([sourceId, { name, logoUrl }]) => ({
      sourceId,
      name,
      logoUrl,
    })),
  );
}

export type CrawlCatalogInput = {
  page: FetchPage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
  /** Crawl at most this many leagues per competition. Unset crawls every league. */
  maxLeagues?: number;
  /** Skip this many leagues at the front of the flat (competition, league) queue. Unset starts
   * at the beginning — see file header for how this composes with `maxLeagues`. */
  offset?: number;
  /** Crawl at most this many leagues from the queue, starting at `offset`. Unset crawls to the
   * end of the queue. */
  limit?: number;
  /** Invoked with each league as it's crawled; return `err` to abort the crawl. */
  onLeague?: (league: CrawlCatalogLeagueResult) => Promise<Result<unknown>>;
};

export type CountCatalogLeaguesInput = {
  page: FetchPage;
  logger: Logger;
  tenantHost: string;
  tenantSlug: string;
  /** Crawl at most this many leagues per competition. Unset crawls every league. Passed the
   * same as a real `crawlCatalog` run would, so the count matches what that run would queue. */
  maxLeagues?: number;
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
  const { page, logger, tenantHost, tenantSlug, seasonYear, maxLeagues, offset, limit, onLeague } =
    input;

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

  const queueResult = await listLeagueQueue(page, logger, tenantId, maxLeagues);
  if (!queueResult.ok) {
    return queueResult;
  }
  const windowStart = offset ?? 0;
  const windowEnd = limit === undefined ? undefined : windowStart + limit;
  const window = queueResult.value.slice(windowStart, windowEnd);
  logger.info("catalog.window", "crawling a window of the league queue", {
    queued: queueResult.value.length,
    offset: windowStart,
    limit: limit ?? null,
    crawling: window.length,
  });

  const results: CrawlCatalogLeagueResult[] = [];

  for (const { competition, league } of window) {
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

  return ok(results);
}

/** Cheap listing-only count of what `crawlCatalog` would queue — no table/fixture fetches, no
 * persistence. Used to size the crawl-catalog.yml matrix (see file header): each matrix leg then
 * passes its own `offset`/`limit` window back into `crawlCatalog`. */
export async function countCatalogLeagues(
  input: CountCatalogLeaguesInput,
): Promise<Result<number>> {
  const { page, logger, tenantHost, tenantSlug, maxLeagues } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }
  logger.info("catalog.tenant", "resolved tenant", { tenantId: tenantResult.value });

  const queueResult = await listLeagueQueue(page, logger, tenantResult.value, maxLeagues);
  if (!queueResult.ok) {
    return queueResult;
  }
  return ok(queueResult.value.length);
}
