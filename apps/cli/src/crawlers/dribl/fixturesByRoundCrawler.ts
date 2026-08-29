// Fixture crawl: iterating round=1..N is deterministic, unlike the SPA's date-windowed views, so
// tabled leagues are crawled round by round. Table-less leagues (e.g. MiniRoos) don't follow
// sequential round numbering, so they fall back to Dribl's current fixture window instead - same
// technique as the catalog crawl's team discovery. Either way the request is cursor-paginated, so
// each page is staged to R2 separately before mapping, for reprocessing.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";
import type { DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import { listFixturePages } from "#crawlers/dribl/driblFixturesApi.ts";
import type { DriblFixturesApiResponse } from "#crawlers/dribl/external/driblFixture.ts";
import { buildRawFixturesKey, buildRawFixtureWindowKey } from "#crawlers/dribl/rawStorageKey.ts";
import type { RawStorage } from "#storage/rawStorage.ts";

const maxConsecutiveEmptyRounds = 2;
const maxRounds = 40;

export type CrawlFixturesByRoundInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  ids: DriblLeagueIds;
  leagueId: string;
  crawlRunId: string;
  /** Table-less leagues (e.g. MiniRoos) don't follow sequential round numbering, so a round-by-
   * round scan undercounts them. Ask Dribl for its current fixture window instead, same technique
   * as the catalog crawl's team discovery. */
  hasTable: boolean;
};

async function stagePages(
  rawStorage: RawStorage,
  logger: Logger,
  responses: DriblFixturesApiResponse[],
  label: string,
  buildKey: (pageNumber: number) => string,
): Promise<Result<void>> {
  for (const [index, response] of responses.entries()) {
    const key = buildKey(index + 1);
    const staged = await rawStorage.putJson(key, response);
    if (!staged.ok) {
      return staged;
    }
    logger.info("crawl.fixturesRound", "fixture page staged", {
      label,
      fixtures: response.data.length,
      key,
    });
  }
  return ok(undefined);
}

async function crawlCurrentFixtureWindow(
  page: FetchPage,
  rawStorage: RawStorage,
  logger: Logger,
  ids: DriblLeagueIds,
  leagueId: string,
  crawlRunId: string,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const label = "current window";
  const pages = await listFixturePages({ page, logger, ids, label });
  if (!pages.ok) {
    return pages;
  }

  if (pages.value.length === 0) {
    logger.debug("crawl.fixturesRound", "current window empty", {});
    return ok([]);
  }

  const staged = await stagePages(rawStorage, logger, pages.value, label, (pageNumber) =>
    buildRawFixtureWindowKey(leagueId, crawlRunId, pageNumber),
  );
  if (!staged.ok) {
    return staged;
  }

  return ok(pages.value);
}

/** One raw response per page of each non-empty round, in round order. */
async function crawlFixturesBySequentialRound(
  page: FetchPage,
  rawStorage: RawStorage,
  logger: Logger,
  ids: DriblLeagueIds,
  leagueId: string,
  crawlRunId: string,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const rawResponses: DriblFixturesApiResponse[] = [];
  let emptyStreak = 0;
  let lastRound = 0;

  for (let round = 1; round <= maxRounds; round++) {
    lastRound = round;
    const label = `round ${round}`;
    const pages = await listFixturePages({
      page,
      logger,
      ids,
      params: { round: String(round) },
      label,
    });
    if (!pages.ok) {
      return pages;
    }

    if (pages.value.length === 0) {
      emptyStreak++;
      logger.debug("crawl.fixturesRound", "empty round", { round, emptyStreak });
      if (emptyStreak >= maxConsecutiveEmptyRounds) {
        logger.debug("crawl.fixturesRound", "stopping after consecutive empty rounds", { round });
        break;
      }
      continue;
    }

    emptyStreak = 0;
    const staged = await stagePages(rawStorage, logger, pages.value, label, (pageNumber) =>
      buildRawFixturesKey(leagueId, crawlRunId, round, pageNumber),
    );
    if (!staged.ok) {
      return staged;
    }

    rawResponses.push(...pages.value);
  }

  if (lastRound === maxRounds) {
    logger.warn("crawl.fixturesRound", "hit maxRounds safety cap without a natural stop", {
      maxRounds,
    });
  }

  return ok(rawResponses);
}

export async function crawlFixturesByRound(
  input: CrawlFixturesByRoundInput,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const { page, rawStorage, logger, ids, leagueId, crawlRunId, hasTable } = input;

  if (!hasTable) {
    return crawlCurrentFixtureWindow(page, rawStorage, logger, ids, leagueId, crawlRunId);
  }

  return crawlFixturesBySequentialRound(page, rawStorage, logger, ids, leagueId, crawlRunId);
}
