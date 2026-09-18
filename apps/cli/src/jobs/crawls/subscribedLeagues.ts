// Subscribed leagues: distinct league ids with >=1 subscription — scopes the crawl-leagues
// GitHub Actions matrix. Dedup across clients already happens in SQL.

import { ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient, listSubscribedLeagueIds } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { chunkLeagueIds, labelLeagueChunks, type LeagueChunk } from "#services/leagueChunks.ts";

export type RunSubscribedLeaguesJobInput = {
  logger: Logger;
  config: CliConfig;
  /** Cap on matrix jobs. Without it the ids are listed ungrouped. */
  maxChunks?: number;
};

export type SubscribedLeaguesSummary = {
  leagueIds: string[];
  /** One labelled group per matrix job; empty unless `maxChunks` was given. */
  chunks: LeagueChunk[];
};

export async function runSubscribedLeaguesJob(
  input: RunSubscribedLeaguesJobInput,
): Promise<Result<SubscribedLeaguesSummary>> {
  const { logger, config, maxChunks } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await listSubscribedLeagueIds(db);
  if (!result.ok) {
    return result;
  }

  const leagueIds = result.value;
  const chunks =
    maxChunks === undefined ? [] : labelLeagueChunks(chunkLeagueIds(leagueIds, maxChunks));

  logger.info("subscribedleagues.result", "listed subscribed league ids", {
    leagueIds,
    count: leagueIds.length,
    chunks,
  });
  return ok({ leagueIds, chunks });
}
