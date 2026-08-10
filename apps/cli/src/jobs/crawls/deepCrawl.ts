// Deep crawl (0012): fixtures + table for exactly one league, discovering clubs/teams as it goes,
// persisted via external_ref. One invocation = one league (docs/plans/2026-07-18-deep-crawl.md) —
// deciding which leagues to invoke this for, and when, is a separate scheduling concern.
//
// This is transport glue (AGENTS.md): it looks up the source's adapter, the real DB client and R2
// client, then delegates crawling and persistence to the adapter's session (source-abstraction
// seam, docs/todo.md Phase 3).

import { ok, type LeagueId, type Logger, type Result } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import { createEntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";
import { createR2RawStorage } from "#storage/rawStorage.ts";

export type RunDeepCrawlJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  leagueId: LeagueId;
  dryRun: boolean;
};

export async function runDeepCrawlJob(input: RunDeepCrawlJobInput): Promise<Result<void>> {
  const { logger, config, source, leagueId, dryRun } = input;

  const adapter = getSourceAdapter(source);
  const sessionResult = await adapter.openSession(config);
  if (!sessionResult.ok) {
    return sessionResult;
  }
  const session = sessionResult.value;

  try {
    const deps = createEntityResolutionDeps(createDbClient(config.DATABASE_URL));
    const rawStorage = createR2RawStorage({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucketName: config.R2_RAW_BUCKET_NAME,
    });

    const result = await session.deepCrawlLeague({ deps, rawStorage, logger, leagueId, dryRun });
    if (!result.ok) {
      return result;
    }

    logger.info("deepcrawl.result", "deep crawl complete", {
      source,
      leagueId,
      dryRun,
      fixtures: result.value.fixtures,
      tableEntries: result.value.tableEntries,
    });
    return ok(undefined);
  } finally {
    await session.close();
  }
}
