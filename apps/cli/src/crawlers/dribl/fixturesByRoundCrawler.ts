// Round-based fixture crawl: iterating round=1..N is deterministic, unlike the SPA's date-windowed
// views. Each non-empty round is staged to R2 before mapping for reprocessing.

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
