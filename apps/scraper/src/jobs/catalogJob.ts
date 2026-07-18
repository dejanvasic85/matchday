// Catalog crawl (0012): cheap, source-wide enumeration of competitions, leagues, teams and their
// clubs for a season, upserted as first-class rows with `external_ref`. Populates the onboarding
// dropdowns; runs on a schedule regardless of subscriptions.
//
// `maxLeagues` caps how many leagues are crawled per competition (see crawlCatalog) — useful for
// keeping a run cheap while iterating on the pipeline. Persistence (DB upserts) is a later slice;
// this job prints the crawled data to the console.

import { ok, type Logger, type Result } from "@matchday/domain";
import { openBrowserSession } from "../crawler/browserSession.ts";
import { crawlCatalog } from "../crawler/crawlCatalog.ts";

export type RunCatalogJobInput = {
  logger: Logger;
  driblSiteUrl: string;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
  maxLeagues?: number;
};

export async function runCatalogJob(input: RunCatalogJobInput): Promise<Result<void>> {
  const { logger, driblSiteUrl, tenantHost, tenantSlug, seasonYear, maxLeagues } = input;

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

    logger.info("catalog.result", "catalog crawl complete", { leagues: crawlResult.value.length });

    for (const { competitionName, leagueName, tableEntries } of crawlResult.value) {
      for (const entry of tableEntries) {
        logger.info("catalog.tableEntry", `${entry.position}. ${entry.teamName}`, {
          competitionName,
          leagueName,
          clubName: entry.clubName,
          clubCode: entry.clubCode,
          played: entry.played,
          points: entry.points,
        });
      }
    }

    return ok(undefined);
  } finally {
    await close();
  }
}
