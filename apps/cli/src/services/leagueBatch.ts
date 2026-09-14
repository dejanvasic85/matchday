// Runs a chunk of leagues through one crawl, deciding what a partial failure means.

import { ok, serverError, type LeagueId, type Logger, type Result } from "@matchday/domain";

export type LeagueBatchDeps = {
  logger: Logger;
  crawlLeague: (leagueId: LeagueId) => Promise<Result<unknown>>;
};

export type LeagueBatchSummary = {
  crawled: number;
  failedLeagueIds: LeagueId[];
};

/**
 * Crawls every league in order. A failure is logged and the batch carries on, so one bad league
 * doesn't cost the others sharing its job — but the batch still reports failure at the end.
 */
export async function crawlLeagueBatch(
  deps: LeagueBatchDeps,
  leagueIds: LeagueId[],
): Promise<Result<LeagueBatchSummary>> {
  const failedLeagueIds: LeagueId[] = [];

  for (const leagueId of leagueIds) {
    const result = await deps.crawlLeague(leagueId);
    if (!result.ok) {
      failedLeagueIds.push(leagueId);
      deps.logger.error("crawlleagues.leaguefailed", result.error.message, {
        leagueId,
        cause: result.error.cause,
      });
    }
  }

  const summary = { crawled: leagueIds.length - failedLeagueIds.length, failedLeagueIds };
  deps.logger.info("crawlleagues.batchresult", "league batch complete", {
    crawled: summary.crawled,
    failed: failedLeagueIds.length,
    total: leagueIds.length,
  });

  if (failedLeagueIds.length > 0) {
    return serverError(`Failed to crawl ${failedLeagueIds.length} of ${leagueIds.length} leagues`, {
      failedLeagueIds,
    });
  }
  return ok(summary);
}
