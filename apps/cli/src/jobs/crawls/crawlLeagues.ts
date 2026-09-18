// Crawls fixtures + table for a chunk of subscribed leagues, discovering clubs/teams as it goes.
// Transport glue: wires the real DB/R2 clients and one browser session, then hands the chunk to
// `crawlLeagueBatch`.

import { ok, type LeagueId, type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  listClientClubWebhooksForClubIds,
  listClubIdsByLeagueId,
  listFixturesByLeagueId,
  listSubscriptionsWithLeague,
  listTableEntriesByLeagueId,
  type Db,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
import {
  createEntityResolutionDeps,
  type EntityResolutionDeps,
} from "#crawlers/dribl/entityResolutionDeps.ts";
import type { SourceSession } from "#crawlers/sourceAdapter.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";
import { crawlLeagueBatch } from "#services/leagueBatch.ts";
import { withLeagueChangeNotification } from "#services/leagueChangeNotifier.ts";
import { createR2RawStorage } from "#storage/rawStorage.ts";
import type { RawStorage } from "#storage/rawStorage.ts";
import { sendWebhook } from "#webhookSender.ts";

export type RunCrawlLeaguesJobInput = {
  logger: Logger;
  config: CliConfig;
  source: CrawlSource;
  leagueIds: LeagueId[];
  dryRun: boolean;
};

type CrawlOneInput = {
  logger: Logger;
  db: Db;
  deps: EntityResolutionDeps;
  session: SourceSession;
  rawStorage: RawStorage;
  source: CrawlSource;
  leagueId: LeagueId;
  dryRun: boolean;
};

async function crawlOneLeague(input: CrawlOneInput): Promise<Result<void>> {
  const { logger, db, deps, session, rawStorage, source, leagueId, dryRun } = input;

  const result = await withLeagueChangeNotification(
    {
      listClubIdsByLeagueId: (id) => listClubIdsByLeagueId(db, id),
      listClientClubWebhooksForClubIds: (clubIds) => listClientClubWebhooksForClubIds(db, clubIds),
      listSubscriptionsWithLeague: (filter) => listSubscriptionsWithLeague(db, filter),
      listFixturesByLeagueId: (id) => listFixturesByLeagueId(db, id),
      listTableEntriesByLeagueId: (id) => listTableEntriesByLeagueId(db, id),
      sendWebhook,
      logger,
      now: () => new Date(),
    },
    { leagueId, dryRun },
    () => session.crawlLeague({ deps, rawStorage, logger, leagueId, dryRun }),
  );
  if (!result.ok) {
    return result;
  }

  logger.info("crawlleagues.result", "league crawl complete", {
    source,
    leagueId,
    dryRun,
    fixtures: result.value.fixtures,
    tableEntries: result.value.tableEntries,
  });
  return ok(undefined);
}

export async function runCrawlLeaguesJob(input: RunCrawlLeaguesJobInput): Promise<Result<void>> {
  const { logger, config, source, leagueIds, dryRun } = input;

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

    const batch = await crawlLeagueBatch(
      {
        logger,
        crawlLeague: (leagueId) =>
          crawlOneLeague({ logger, db, deps, session, rawStorage, source, leagueId, dryRun }),
      },
      leagueIds,
    );
    return batch.ok ? ok(undefined) : batch;
  } finally {
    await session.close();
  }
}
