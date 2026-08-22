// The Dribl `SourceAdapter` (0012): opens a Cloudflare-cleared browser session and exposes the
// crawl operations plus countCatalogLeagues, a cheap listing-only sizer for crawl-catalog.yml.

import { ok, type Result } from "@matchday/domain";
import type {
  CountCatalogLeaguesParams,
  CountCatalogLeaguesSummary,
  CrawlCatalogParams,
  CrawlCatalogSummary,
  CrawlClubEnrichmentParams,
  CrawlClubEnrichmentSummary,
  DeepCrawlParams,
  DeepCrawlSummary,
  SourceAdapter,
} from "#crawlers/sourceAdapter.ts";
import { crawlSourceValue } from "#crawlers/constants.ts";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { openBrowserSession } from "#crawlers/dribl/browserSession.ts";
import {
  countCatalogLeagues,
  crawlCatalog,
  type CrawlCatalogLeagueResult,
} from "#crawlers/dribl/catalogCrawler.ts";
import { logCatalogDryRun } from "#crawlers/dribl/catalogDryRunLogger.ts";
import { persistLeague } from "#crawlers/dribl/catalogPersistence.ts";
import { crawlClubEnrichment } from "#crawlers/dribl/clubEnrichmentCrawler.ts";
import { logClubEnrichmentDryRun } from "#crawlers/dribl/clubEnrichmentDryRunLogger.ts";
import { persistClubEnrichment } from "#crawlers/dribl/clubEnrichmentPersistence.ts";
import { crawlerConfigValue } from "#crawlers/dribl/constants.ts";
import { resolveTenantId } from "#crawlers/dribl/driblCatalogApi.ts";
import { deepCrawlLeague } from "#crawlers/dribl/leagueDeepCrawler.ts";

type TenantContext = {
  page: FetchPage;
  tenantHost: string;
  tenantSlug: string;
};

// Distinct competitions/clubs/teams touched by a catalog crawl, accumulated incrementally so the
// non-dry-run path never has to buffer the whole catalog just to count it.
type CatalogStats = {
  competitionIds: Set<string>;
  clubCodes: Set<string>;
  teamIds: Set<string>;
  leagues: number;
  tableEntries: number;
};

function createCatalogStats(): CatalogStats {
  return {
    competitionIds: new Set(),
    clubCodes: new Set(),
    teamIds: new Set(),
    leagues: 0,
    tableEntries: 0,
  };
}

function addLeagueToCatalogStats(stats: CatalogStats, league: CrawlCatalogLeagueResult): void {
  stats.competitionIds.add(league.competitionSourceId);
  stats.leagues += 1;
  stats.tableEntries += league.tableEntries.length;
  for (const entry of league.tableEntries) {
    stats.clubCodes.add(entry.clubCode);
    stats.teamIds.add(entry.teamSourceId);
  }
  // Fixture-fallback teams (tables-less leagues, e.g. MiniRoos) have no club — count the team,
  // not a club.
  for (const fixtureTeam of league.fixtureTeams) {
    stats.teamIds.add(fixtureTeam.sourceId);
  }
}

function summarizeCatalogStats(stats: CatalogStats): CrawlCatalogSummary {
  return {
    competitions: stats.competitionIds.size,
    leagues: stats.leagues,
    clubs: stats.clubCodes.size,
    teams: stats.teamIds.size,
    tableEntries: stats.tableEntries,
  };
}

async function runCatalogCrawl(
  input: TenantContext & CrawlCatalogParams,
): Promise<Result<CrawlCatalogSummary>> {
  const {
    page,
    tenantHost,
    tenantSlug,
    seasonYear,
    maxLeagues,
    offset,
    limit,
    dryRun,
    deps,
    logger,
  } = input;
  const stats = createCatalogStats();

  if (dryRun) {
    const crawlResult = await crawlCatalog({
      page,
      logger,
      tenantHost,
      tenantSlug,
      seasonYear,
      maxLeagues,
      offset,
      limit,
    });
    if (!crawlResult.ok) {
      return crawlResult;
    }
    logCatalogDryRun(logger, crawlResult.value);
    for (const league of crawlResult.value) {
      addLeagueToCatalogStats(stats, league);
    }
    return ok(summarizeCatalogStats(stats));
  }

  const crawlResult = await crawlCatalog({
    page,
    logger,
    tenantHost,
    tenantSlug,
    seasonYear,
    maxLeagues,
    offset,
    limit,
    onLeague: async (league) => {
      const persisted = await persistLeague({ deps, logger, league });
      if (persisted.ok) {
        addLeagueToCatalogStats(stats, league);
      }
      return persisted;
    },
  });
  if (!crawlResult.ok) {
    return crawlResult;
  }

  return ok(summarizeCatalogStats(stats));
}

async function runCountCatalogLeagues(
  input: TenantContext & CountCatalogLeaguesParams,
): Promise<Result<CountCatalogLeaguesSummary>> {
  const { page, tenantHost, tenantSlug, maxLeagues, logger } = input;

  const countResult = await countCatalogLeagues({
    page,
    logger,
    tenantHost,
    tenantSlug,
    maxLeagues,
  });
  if (!countResult.ok) {
    return countResult;
  }

  return ok({ total: countResult.value });
}

async function runDeepCrawl(
  input: TenantContext & DeepCrawlParams,
): Promise<Result<DeepCrawlSummary>> {
  const { page, tenantHost, tenantSlug, leagueId, dryRun, deps, rawStorage, logger } = input;

  const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
  if (!tenantResult.ok) {
    return tenantResult;
  }

  return deepCrawlLeague({
    page,
    rawStorage,
    logger,
    deps,
    leagueId,
    tenantId: tenantResult.value,
    dryRun,
    generateCrawlRunId: () => crypto.randomUUID(),
  });
}

async function runClubEnrichmentCrawl(
  input: TenantContext & CrawlClubEnrichmentParams,
): Promise<Result<CrawlClubEnrichmentSummary>> {
  const {
    page,
    tenantHost,
    tenantSlug,
    dryRun,
    deps,
    rawStorage,
    assetStorage,
    downloadImage,
    publicAssetsBaseUrl,
    logger,
  } = input;
  const crawlRunId = crypto.randomUUID();

  if (dryRun) {
    const crawlResult = await crawlClubEnrichment({
      page,
      rawStorage,
      logger,
      tenantHost,
      tenantSlug,
      crawlRunId,
    });
    if (!crawlResult.ok) {
      return crawlResult;
    }
    logClubEnrichmentDryRun(logger, crawlResult.value);
    return ok({ listed: crawlResult.value.length, updated: 0, skipped: 0 });
  }

  let updated = 0;
  let skipped = 0;
  const crawlResult = await crawlClubEnrichment({
    page,
    rawStorage,
    logger,
    tenantHost,
    tenantSlug,
    crawlRunId,
    onClub: async (club) => {
      const persisted = await persistClubEnrichment({
        deps,
        assetStorage,
        downloadImage,
        publicAssetsBaseUrl,
        logger,
        club,
      });
      if (persisted.ok) {
        if (persisted.value === "updated") {
          updated += 1;
        } else {
          skipped += 1;
        }
      }
      return persisted;
    },
  });
  if (!crawlResult.ok) {
    return crawlResult;
  }

  return ok({ listed: crawlResult.value.length, updated, skipped });
}

export const driblAdapter: SourceAdapter = {
  source: crawlSourceValue.dribl,
  async openSession(config) {
    const sessionResult = await openBrowserSession({
      driblSiteUrl: crawlerConfigValue.tenantSiteUrl,
      browserWsEndpoint: config.BROWSER_WS_ENDPOINT,
    });
    if (!sessionResult.ok) {
      return sessionResult;
    }
    const { page, close } = sessionResult.value;
    const tenantHost = new URL(crawlerConfigValue.tenantSiteUrl).host;
    const tenantSlug = crawlerConfigValue.tenantSlug;

    return ok({
      close,
      crawlCatalog: (params) => runCatalogCrawl({ page, tenantHost, tenantSlug, ...params }),
      countCatalogLeagues: (params) =>
        runCountCatalogLeagues({ page, tenantHost, tenantSlug, ...params }),
      deepCrawlLeague: (params) => runDeepCrawl({ page, tenantHost, tenantSlug, ...params }),
      crawlClubEnrichment: (params) =>
        runClubEnrichmentCrawl({ page, tenantHost, tenantSlug, ...params }),
    });
  },
};
