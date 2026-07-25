// Table (ladder) crawl: a single request after the round crawl, using the same resolved IDs
// (dribl-crawling skill). Raw response staged to R2 before mapping, per 0004. Dribl's own
// endpoint/wire format calls this a "ladder" — our side of the boundary calls it "table".

import { err, ok, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "./browserFetch.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "./driblApiUrl.ts";
import {
  driblTableApiResponseSchema,
  type DriblTableApiResponse,
} from "./external/driblTableEntry.ts";
import type { RawStorage } from "./rawStorage.ts";
import { buildRawTableKey } from "./rawStorageKey.ts";

export type CrawlTableInput = {
  page: FetchPage;
  rawStorage: RawStorage;
  logger: Logger;
  ids: DriblLeagueIds;
  leagueId: string;
  crawlRunId: string;
};

/** `undefined` when the league has no table (e.g. MiniRoos) — not an error. */
export async function crawlTable(
  input: CrawlTableInput,
): Promise<Result<DriblTableApiResponse | undefined>> {
  const { page, rawStorage, logger, ids, leagueId, crawlRunId } = input;

  const url = buildDriblApiUrl("ladders", ids);
  const fetched = await browserFetch(page, url);
  if (!fetched.ok) {
    return fetched;
  }

  const parsed = driblTableApiResponseSchema.safeParse(fetched.value);
  if (!parsed.success) {
    return err({ message: "Failed to validate table response", cause: parsed.error });
  }

  if (parsed.data.data.length === 0) {
    logger.debug("crawl.table", "no table entries, skipping");
    return ok(undefined);
  }

  const key = buildRawTableKey(leagueId, crawlRunId);
  const staged = await rawStorage.putJson(key, parsed.data);
  if (!staged.ok) {
    return staged;
  }

  logger.info("crawl.table", "table staged", { entries: parsed.data.data.length, key });
  return ok(parsed.data);
}
