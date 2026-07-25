// Deep crawl (0012): fixtures + table for exactly one league, discovering clubs/teams as it goes,
// persisted via external_ref. One invocation = one league (docs/plans/2026-07-18-deep-crawl.md) —
// deciding which leagues to invoke this for, and when, is a separate scheduling concern.
//
// This is transport glue (AGENTS.md): it constructs the real browser session, DB client and R2
// client, then delegates crawling and persistence to deepCrawlLeague.

import { ok, type LeagueId, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import { openBrowserSession } from "../crawler/browserSession.ts";
import { deepCrawlLeague } from "../crawler/deepCrawlLeague.ts";
import { createEntityResolutionDeps } from "../crawler/entityResolutionDeps.ts";
import { resolveTenantId } from "../crawler/listDriblCatalog.ts";
import { createR2RawStorage, type RawStorageConfig } from "../crawler/rawStorage.ts";

export type RunDeepCrawlJobInput = {
  logger: Logger;
  databaseUrl: string;
  driblSiteUrl: string;
  browserWsEndpoint?: string;
  tenantHost: string;
  tenantSlug: string;
  leagueId: LeagueId;
  dryRun: boolean;
  rawStorageConfig: RawStorageConfig;
};

export async function runDeepCrawlJob(input: RunDeepCrawlJobInput): Promise<Result<void>> {
  const {
    logger,
    databaseUrl,
    driblSiteUrl,
    browserWsEndpoint,
    tenantHost,
    tenantSlug,
    leagueId,
    dryRun,
  } = input;

  const sessionResult = await openBrowserSession({ driblSiteUrl, browserWsEndpoint });
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const { page, close } = sessionResult.value;

  try {
    const tenantResult = await resolveTenantId(page, tenantHost, tenantSlug);
    if (!tenantResult.ok) {
      return tenantResult;
    }

    const deps = createEntityResolutionDeps(createDbClient(databaseUrl));
    const rawStorage = createR2RawStorage(input.rawStorageConfig);

    const result = await deepCrawlLeague({
      page,
      rawStorage,
      logger,
      deps,
      leagueId,
      tenantId: tenantResult.value,
      dryRun,
      generateCrawlRunId: () => crypto.randomUUID(),
    });
    if (!result.ok) {
      return result;
    }

    logger.info("deepcrawl.result", "deep crawl complete", {
      leagueId,
      dryRun,
      fixtures: result.value.fixtures,
      tableEntries: result.value.tableEntries,
    });
    return ok(undefined);
  } finally {
    await close();
  }
}
