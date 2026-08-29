// Deep crawl: fixtures + table for exactly one league, discovering clubs/teams as it goes.
// Transport glue that wires the real DB/R2 clients and wraps the crawl with `withLeagueChangeNotification`.

import { ok, type LeagueId, type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  listActiveSubscriptionsForLeagueWithWebhook,
  listFixturesByLeagueId,
  listTableEntriesByLeagueId,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import { createEntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";
import { withLeagueChangeNotification } from "#services/deepCrawlWebhookNotifier.ts";
import { createR2RawStorage } from "#storage/rawStorage.ts";
import { sendWebhook } from "#webhookSender.ts";

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
    const db = createDbClient(config.DATABASE_URL);
    const deps = createEntityResolutionDeps(db);
    const rawStorage = createR2RawStorage({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucketName: config.R2_RAW_BUCKET_NAME,
    });

    const result = await withLeagueChangeNotification(
      {
        listActiveSubscriptionsForLeagueWithWebhook: (id) =>
          listActiveSubscriptionsForLeagueWithWebhook(db, id),
        listFixturesByLeagueId: (id) => listFixturesByLeagueId(db, id),
        listTableEntriesByLeagueId: (id) => listTableEntriesByLeagueId(db, id),
        sendWebhook,
        logger,
        now: () => new Date(),
      },
      { leagueId, dryRun },
      () => session.deepCrawlLeague({ deps, rawStorage, logger, leagueId, dryRun }),
    );
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
