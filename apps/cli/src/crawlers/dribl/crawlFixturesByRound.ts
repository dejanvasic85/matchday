// Round-based fixture crawl (dribl-crawling skill): iterating round=1..N is deterministic and
// never drops rounds, unlike the SPA's date-windowed views. Each non-empty round's raw response
// is staged to R2 before mapping, per 0004, so a bad transform can be reprocessed without
// re-crawling.

import {
  driblFixturesApiResponseSchema,
  err,
  ok,
  type DriblFixturesApiResponse,
  type Logger,
  type Result,
} from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "./buildDriblApiUrl.ts";
import { buildRawFixturesKey } from "./rawStorageKey.ts";
import type { RawStorage } from "./rawStorage.ts";

const maxConsecutiveEmptyRounds = 2;
const maxRounds = 40;

export type CrawlFixturesByRoundInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  ids: DriblLeagueIds;
  leagueId: string;
  crawlRunId: string;
};

/** One raw response per non-empty round, in round order. */
export async function crawlFixturesByRound(
  input: CrawlFixturesByRoundInput,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const { page, rawStorage, logger, ids, leagueId, crawlRunId } = input;

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
      return err({
        message: `Failed to validate fixtures response for round ${round}`,
        cause: parsed.error,
      });
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
