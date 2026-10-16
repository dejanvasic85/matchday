// Crawl scope: the league ids one source's deep crawl visits this run, resolved from the crawl
// targets. It scopes the crawl-leagues GitHub Actions matrix, which passes the source it runs.

import { ok, todayInMelbourne, type IsoDate, type Logger, type Result } from "@matchday/domain";
import { createDbClient, listCrawlTargetLeagueCandidates } from "@matchday/db";
import { resolveCrawlScope } from "@matchday/services";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import { chunkLeagueIds, labelLeagueChunks, type LeagueChunk } from "#services/leagueChunks.ts";

export type RunCrawlScopeJobInput = {
  logger: Logger;
  config: CliConfig;
  /** Whose leagues to list: each source crawls only the leagues it owns. */
  source: CrawlSource;
  /** Cap on matrix jobs. Without it the ids are listed ungrouped. */
  maxChunks?: number;
  /** Injected for testability; defaults to the real Melbourne "today". */
  today?: IsoDate;
};

export type CrawlScopeSummary = {
  leagueIds: string[];
  /** One labelled group per matrix job; empty unless `maxChunks` was given. */
  chunks: LeagueChunk[];
};

export async function runCrawlScopeJob(
  input: RunCrawlScopeJobInput,
): Promise<Result<CrawlScopeSummary>> {
  const { logger, config, source, maxChunks, today = todayInMelbourne() } = input;

  const db = createDbClient(config.DATABASE_URL);
  const scope = await resolveCrawlScope(
    { listCrawlTargetLeagueCandidates: () => listCrawlTargetLeagueCandidates(db) },
    today,
    source,
  );
  if (!scope.ok) {
    return scope;
  }

  // Warn on the way to the result: a target that resolved to nothing would otherwise just vanish
  // from the crawl. stdout keeps the one result line the workflow parses.
  for (const target of scope.value.skipped) {
    logger.warn("crawlscope.targetskipped", `crawl target has no ${source} league to crawl`, {
      competition: target.competitionName,
      league: target.leagueName,
    });
  }

  const leagueIds = scope.value.leagueIds;
  const chunks =
    maxChunks === undefined ? [] : labelLeagueChunks(chunkLeagueIds(leagueIds, maxChunks));

  logger.info("crawlscope.result", "resolved crawl scope", {
    leagueIds,
    count: leagueIds.length,
    skipped: scope.value.skipped.length,
    chunks,
  });
  return ok({ leagueIds, chunks });
}
