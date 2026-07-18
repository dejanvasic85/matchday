// Catalog crawl (0012): cheap, source-wide enumeration of competitions, leagues, teams and their
// clubs for a season, upserted as first-class rows with `external_ref`. Populates the onboarding
// dropdowns; runs on a schedule regardless of subscriptions.
//
// Debug mode (current slice): walks only the first competition and its first league, printing
// the resulting table (teams + clubs) to the console instead of persisting. The full
// all-competitions/all-leagues crawl + DB upserts land in a later slice.

import { ok, type Logger, type Result } from "@matchday/domain";
import { crawlCatalogDebug } from "../crawler/crawlCatalogDebug.ts";
import { openBrowserSession } from "../crawler/browserSession.ts";

export type RunCatalogJobInput = {
  logger: Logger;
  driblSiteUrl: string;
  tenantHost: string;
  tenantSlug: string;
  seasonYear: string;
};

export async function runCatalogJob(input: RunCatalogJobInput): Promise<Result<void>> {
  const { logger, driblSiteUrl, tenantHost, tenantSlug, seasonYear } = input;

  const sessionResult = await openBrowserSession({ driblSiteUrl });
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const { page, close } = sessionResult.value;

  try {
    const debugResult = await crawlCatalogDebug({
      page,
      logger,
      tenantHost,
      tenantSlug,
      seasonYear,
    });
    if (!debugResult.ok) {
      return debugResult;
    }

    const { competitionName, leagueName, seasonName, tableEntries } = debugResult.value;
    logger.info("catalog.debug.result", "catalog debug crawl complete", {
      season: seasonName,
      competition: competitionName,
      league: leagueName,
      teams: tableEntries.length,
    });

    for (const entry of tableEntries) {
      logger.info("catalog.debug.tableEntry", `${entry.position}. ${entry.teamName}`, {
        clubName: entry.clubName,
        clubCode: entry.clubCode,
        played: entry.played,
        points: entry.points,
      });
    }

    return ok(undefined);
  } finally {
    await close();
  }
}
