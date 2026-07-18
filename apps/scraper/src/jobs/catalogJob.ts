// Catalog crawl (0012): cheap, source-wide enumeration of competitions, leagues, teams and their
// clubs for a season, upserted as first-class rows with `external_ref`. Populates the onboarding
// dropdowns; runs on a schedule regardless of subscriptions.
//
// `maxLeagues` caps how many leagues are crawled per competition (see crawlCatalog) — useful for
// keeping a run cheap while iterating on the pipeline. `dryRun` crawls but skips all DB writes,
// logging the crawled data instead — for inspecting a run without mutating the catalog.
//
// This is transport glue (AGENTS.md): it constructs the real browser session + DB client, then
// delegates crawling and persistence to their pure services.

import { ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import { openBrowserSession } from "../crawler/browserSession.ts";
import { crawlCatalog } from "../crawler/crawlCatalog.ts";
import { createEntityResolutionDeps } from "../crawler/entityResolutionDeps.ts";
import { logCatalogDryRun } from "../crawler/logCatalogDryRun.ts";
import { persistCatalog } from "../crawler/persistCatalog.ts";

export type RunCatalogJobInput = {
  logger: Logger;
  databaseUrl: string;
  driblSiteUrl: string;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
  maxLeagues?: number;
  dryRun: boolean;
};

export async function runCatalogJob(input: RunCatalogJobInput): Promise<Result<void>> {
  const { logger, databaseUrl, driblSiteUrl, tenantHost, tenantSlug, seasonYear, maxLeagues } =
    input;

  const sessionResult = await openBrowserSession({ driblSiteUrl });
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const { page, close } = sessionResult.value;

  try {
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

    if (input.dryRun) {
      logCatalogDryRun(logger, crawlResult.value);
      return ok(undefined);
    }

    const deps = createEntityResolutionDeps(createDbClient(databaseUrl));
    const persistResult = await persistCatalog({ deps, logger, leagues: crawlResult.value });
    if (!persistResult.ok) {
      return persistResult;
    }

    logger.info("catalog.result", "catalog crawl persisted", persistResult.value);
    return ok(undefined);
  } finally {
    await close();
  }
}
