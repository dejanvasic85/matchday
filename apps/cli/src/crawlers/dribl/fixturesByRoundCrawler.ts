// Fixture crawl: iterating round=1..N is deterministic, unlike the SPA's date-windowed views, so
// tabled leagues are crawled round by round. Table-less leagues (e.g. MiniRoos) don't follow
// sequential round numbering, so they fall back to Dribl's current fixture window instead - same
// technique as the catalog crawl's team discovery. Each non-empty response is staged to R2 before
// mapping for reprocessing.

import { ok, serverError, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import {
  driblFixturesApiResponseSchema,
  type DriblFixturesApiResponse,
} from "#crawlers/dribl/external/driblFixture.ts";
import { buildRawFixturesKey } from "#crawlers/dribl/rawStorageKey.ts";
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

async function fetchCurrentFixtureWindow(
  page: FetchPage,
  rawStorage: RawStorage,
  logger: Logger,
  ids: DriblLeagueIds,
  leagueId: string,
  crawlRunId: string,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const url = buildDriblApiUrl("fixtures", ids);
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblFixturesApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return serverError("Failed to validate fixtures response for current window", parsed.error);
  }

  if (parsed.data.data.length === 0) {
    logger.debug("crawl.fixturesRound", "current window empty", {});
    return ok([]);
  }

  const key = buildRawFixturesKey(leagueId, crawlRunId, 1);
  const staged = await rawStorage.putJson(key, parsed.data);
  if (!staged.ok) {
    return staged;
  }

  logger.info("crawl.fixturesRound", "current window staged", {
    fixtures: parsed.data.data.length,
    key,
  });

  return ok([parsed.data]);
}

/** One raw response per non-empty round, in round order. */
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
    const url = buildDriblApiUrl("fixtures", ids, { round: String(round) });
    const fetched = await browserFetch(page, url);
    if (!fetched.ok) {
      return fetched;
    }

    const parsed = driblFixturesApiResponseSchema.safeParse(fetched.value);
    if (!parsed.success) {
      return serverError(`Failed to validate fixtures response for round ${round}`, parsed.error);
    }

    if (parsed.data.data.length === 0) {
      emptyStreak++;
      logger.debug("crawl.fixturesRound", "empty round", { round, emptyStreak });
      if (emptyStreak >= maxConsecutiveEmptyRounds) {
        logger.debug("crawl.fixturesRound", "stopping after consecutive empty rounds", { round });
        break;
      }
      continue;
    }

    emptyStreak = 0;
    const key = buildRawFixturesKey(leagueId, crawlRunId, round);
    const staged = await rawStorage.putJson(key, parsed.data);
    if (!staged.ok) {
      return staged;
    }

    rawResponses.push(parsed.data);
    logger.info("crawl.fixturesRound", "round staged", {
      round,
      fixtures: parsed.data.data.length,
      key,
    });
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
    return fetchCurrentFixtureWindow(page, rawStorage, logger, ids, leagueId, crawlRunId);
  }

  return crawlFixturesBySequentialRound(page, rawStorage, logger, ids, leagueId, crawlRunId);
}
