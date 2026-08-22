// Count catalog leagues (0012): cheap listing-only companion to the catalog crawl (no fetches or
// persistence) — sizes the crawl-catalog.yml matrix ahead of the real crawl.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";

export type RunCountCatalogLeaguesJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  maxLeagues?: number;
};

export async function runCountCatalogLeaguesJob(
  input: RunCountCatalogLeaguesJobInput,
): Promise<Result<number>> {
  const { logger, config, source, maxLeagues } = input;

  const adapter = getSourceAdapter(source);
  const sessionResult = await adapter.openSession(config);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  try {
    const result = await session.countCatalogLeagues({ logger, maxLeagues });
    if (!result.ok) {
      return result;
    }

    logger.info("catalog.count.result", "counted catalog leagues", { total: result.value.total });
    return ok(result.value.total);
  } finally {
    await session.close();
  }
}
