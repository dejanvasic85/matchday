// Crawls + persists fixtures and the table for one subscribed league. One invocation = one
// league — see docs/plans/2026-07-18-deep-crawl.md for why leagues crawl independently.

import { ok, type LeagueId, type Logger, type Result } from "@matchday/domain";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { crawlFixturesByRound } from "#crawlers/dribl/fixturesByRoundCrawler.ts";
import { crawlTable } from "#crawlers/dribl/tableCrawler.ts";
import { deepCrawlPersist } from "#crawlers/dribl/deepCrawlPersistence.ts";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";
import type { RawStorage } from "#storage/rawStorage.ts";
import { resolveDriblLeagueIds } from "#crawlers/dribl/driblLeagueIdResolver.ts";

export type DeepCrawlLeagueInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  deps: EntityResolutionDeps;
  leagueId: LeagueId;
  tenantId: string;
  dryRun: boolean;
  /** DI'd so tests don't depend on the real `crypto.randomUUID` global. */
  generateCrawlRunId: () => string;
};

export type DeepCrawlLeagueSummary = {
  fixtures: number;
  tableEntries: number;
};

export async function deepCrawlLeague(
  input: DeepCrawlLeagueInput,
): Promise<Result<DeepCrawlLeagueSummary>> {
  const { page, rawStorage, logger, deps, leagueId, tenantId, dryRun, generateCrawlRunId } = input;

  const resolved = await resolveDriblLeagueIds({ deps, leagueId });
  if (!resolved.ok) {
    return resolved;
  }
  const { hashes, context } = resolved.value;
  const ids = { ...hashes, tenant: tenantId };
  const crawlRunId = generateCrawlRunId();

  const fixturesResult = await crawlFixturesByRound({
    page,
    rawStorage,
    logger,
    ids,
    leagueId,
    crawlRunId,
    hasTable: context.hasTable,
  });
  if (!fixturesResult.ok) {
    return fixturesResult;
  }

  const tableResult = await crawlTable({ page, rawStorage, logger, ids, leagueId, crawlRunId });
  if (!tableResult.ok) {
    return tableResult;
  }

  const fixtureCount = fixturesResult.value.reduce(
    (sum, response) => sum + response.data.length,
    0,
  );
  const tableEntryCount = tableResult.value?.data.length ?? 0;

  if (dryRun) {
    logger.info("deepcrawl.league.dryRun", "crawl complete (dry run, not persisted)", {
      leagueId,
      fixtures: fixtureCount,
      tableEntries: tableEntryCount,
    });
    return ok({ fixtures: fixtureCount, tableEntries: tableEntryCount });
  }

  return deepCrawlPersist({
    deps,
    logger,
    context,
    fixtureResponses: fixturesResult.value,
    tableResponse: tableResult.value,
  });
}
