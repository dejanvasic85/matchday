// Subscribed leagues (0012): the distinct set of league ids with >=1 subscription — the scope
// the deep-crawl GitHub Actions matrix crawls this run. Thin transport glue (AGENTS.md); dedup
// across clients already happens in SQL (subscriptionDb.listSubscribedLeagueIds).

import { ok, type Logger, type Result } from "@matchday/domain";
import { createDbClient, listSubscribedLeagueIds } from "@matchday/db";
import type { CliConfig } from "../../config.ts";

export type RunSubscribedLeaguesJobInput = {
  logger: Logger;
  config: CliConfig;
};

export async function runSubscribedLeaguesJob(
  input: RunSubscribedLeaguesJobInput,
): Promise<Result<string[]>> {
  const { logger, config } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await listSubscribedLeagueIds(db);
  if (!result.ok) {
    return result;
  }

  logger.info("subscribedleagues.result", "listed subscribed league ids", {
    leagueIds: result.value,
    count: result.value.length,
  });
  return ok(result.value);
}
