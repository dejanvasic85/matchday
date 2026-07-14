// Ladder (table) crawl: a single request after the round crawl, using the same resolved IDs
// (dribl-crawling skill). Raw response staged to R2 before mapping, per 0004.

import { driblTableApiResponseSchema, err, ok, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "./buildDriblApiUrl.ts";
import type { RawStorage } from "./rawStorage.ts";
import { buildRawLaddersKey } from "./rawStorageKey.ts";

export type CrawlLaddersInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  ids: DriblLeagueIds;
  trackedCompetitionId: string;
  crawlRunId: string;
};

/** `undefined` when the league has no ladder (e.g. MiniRoos) — not an error. */
export async function crawlLadders(input: CrawlLaddersInput): Promise<Result<unknown>> {
  const { page, rawStorage, logger, ids, trackedCompetitionId, crawlRunId } = input;

  const url = buildDriblApiUrl("ladders", ids);
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblTableApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({ message: "Failed to validate ladders response", cause: parsed.error });
  }

  if (parsed.data.data.length === 0) {
    logger.debug("crawl.ladders", "no ladder entries, skipping");
    return ok(undefined);
  }

  const key = buildRawLaddersKey(trackedCompetitionId, crawlRunId);
  const staged = await rawStorage.putJson(key, parsed.data);
  if (!staged.ok) {
    return staged;
  }

  logger.info("crawl.ladders", "ladder staged", { entries: parsed.data.data.length, key });
  return ok(parsed.data);
}
