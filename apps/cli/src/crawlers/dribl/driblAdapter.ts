// The Dribl `SourceAdapter` (0012, docs/todo.md Phase 3): opens a Cloudflare-cleared browser
// session (see browserSession.ts / the dribl-crawling skill) and exposes the three crawl
// operations against it. Each operation's body is the dry-run-vs-persist orchestration that used
// to live in src/jobs/*.ts, relocated here unchanged now that jobs are source-agnostic dispatchers.

import { ok, type Result } from "@matchday/domain";
import type {
  CrawlCatalogParams,
  CrawlCatalogSummary,
  CrawlClubEnrichmentParams,
  CrawlClubEnrichmentSummary,
  DeepCrawlParams,
  DeepCrawlSummary,
  SourceAdapter,
} from "../sourceAdapter.ts";
import { crawlSourceValue } from "../constants.ts";
import type { FetchPage } from "./browserFetch.ts";
import { openBrowserSession } from "./browserSession.ts";
import { crawlCatalog } from "./catalogCrawler.ts";
import { logCatalogDryRun } from "./catalogDryRunLogger.ts";
import { persistLeague } from "./catalogPersistence.ts";
import { crawlClubEnrichment } from "./clubEnrichmentCrawler.ts";
import { logClubEnrichmentDryRun } from "./clubEnrichmentDryRunLogger.ts";
import { persistClubEnrichment } from "./clubEnrichmentPersistence.ts";
import { resolveTenantId } from "./driblCatalogApi.ts";
import { deepCrawlLeague } from "./leagueDeepCrawler.ts";

type TenantContext = {
  page: FetchPage;
  tenantHost: string;
  tenantSlug: string;
};

export async function runCatalogCrawl(
  input: TenantContext & CrawlCatalogParams,
): Promise<Result<CrawlCatalogSummary>> {
  const { page, tenantHost, tenantSlug, seasonYear, maxLeagues, dryRun, deps, logger } = input;

  if (dryRun) {
    const crawlResult = await crawlCatalog({
      page,
      logger,
      tenantHost,
      tenantSlug,
      seasonYear,
      maxLeagues,
    });
    if (!crawlResult.ok) {
      return crawlResult;
    }
    logCatalogDryRun(logger, crawlResult.value);
    const tableEntries = crawlResult.value.reduce(
      (sum, league) => sum + league.tableEntries.length,
      0,
    );
    return ok({ leagues: crawlResult.value.length, tableEntries });
  }

  let leagueCount = 0;
  let tableEntryCount = 0;
  const crawlResult = await crawlCatalog({
    page,
    logger,
    tenantHost,
    tenantSlug,
    seasonYear,
    maxLeagues,
    onLeague: async (league) => {
      const persisted = await persistLeague({ deps, logger, league });
      if (persisted.ok) {
        leagueCount += 1;
        tableEntryCount += persisted.value.tableEntries;
      }
      return persisted;
    },
  });
  if (!crawlResult.ok) {
    return crawlResult;
  }

  return ok({ leagues: leagueCount, tableEntries: tableEntryCount });
}

export async function runDeepCrawl(
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

export async function runClubEnrichmentCrawl(
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
      driblSiteUrl: config.DRIBL_SITE_URL,
      browserWsEndpoint: config.BROWSER_WS_ENDPOINT,
    });
    if (!sessionResult.ok) {
      return sessionResult;
    }
    const { page, close } = sessionResult.value;
    const tenantHost = new URL(config.DRIBL_SITE_URL).host;
    const tenantSlug = config.DRIBL_TENANT_SLUG;

    return ok({
      close,
      crawlCatalog: (params) => runCatalogCrawl({ page, tenantHost, tenantSlug, ...params }),
      deepCrawlLeague: (params) => runDeepCrawl({ page, tenantHost, tenantSlug, ...params }),
      crawlClubEnrichment: (params) =>
        runClubEnrichmentCrawl({ page, tenantHost, tenantSlug, ...params }),
    });
  },
};
