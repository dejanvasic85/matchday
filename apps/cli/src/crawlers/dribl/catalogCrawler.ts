// Catalog crawl: `offset`/`limit` window the flat league queue so crawl-catalog.yml can split one
// crawl into parallel legs. Table-less leagues (e.g. MiniRoos) fall back to current fixtures for
// teams.

import { notFound, ok, serverError, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";
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

/** Records a fixture team sighting, keyed by source id. A null logo on one sighting (e.g. a
 * fixture where Dribl didn't populate it) must not clobber a real logo from another — the
 * club-bridge match needs whichever logo this team has shown. */
function recordFixtureTeamSighting(
  teamsBySourceId: Map<string, { name: string; logoUrl: string | null }>,
  sourceId: string,
  name: string,
  logoUrl: string | null,
): void {
  const existing = teamsBySourceId.get(sourceId);
  teamsBySourceId.set(sourceId, { name, logoUrl: logoUrl ?? existing?.logoUrl ?? null });
}

/** Discovers teams from a league's current fixtures — the fallback for a league with no table.
 * Omitting `round` asks Dribl for its current window, same as the site's default view. A team on
 * a bye right now is still missed, but self-heals on the next weekly crawl once it plays. */
async function discoverTeamsFromFixtures(
  page: FetchPage,
  ids: DriblLeagueIds,
): Promise<Result<CatalogFixtureTeam[]>> {
  const teamsBySourceId = new Map<string, { name: string; logoUrl: string | null }>();

  const url = buildDriblApiUrl("fixtures", ids);
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblFixturesApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return serverError("Failed to validate fixtures response", parsed.error);
  }

  for (const fixture of parsed.data.data) {
    const mapped = mapDriblFixture(fixture);
    if (mapped.homeTeamSourceId !== null && mapped.homeTeamName !== null) {
      recordFixtureTeamSighting(
        teamsBySourceId,
        mapped.homeTeamSourceId,
        mapped.homeTeamName,
        mapped.homeTeamLogoUrl,
      );
    }
    if (mapped.awayTeamSourceId !== null && mapped.awayTeamName !== null) {
      recordFixtureTeamSighting(
        teamsBySourceId,
        mapped.awayTeamSourceId,
        mapped.awayTeamName,
        mapped.awayTeamLogoUrl,
      );
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
        withoutLogo: fixtureTeams.filter((team) => team.logoUrl === null).length,
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
