// Dribl's api/fixtures is cursor-paginated at 30 records a page and ignores page/per_page/
// disable_paging — following meta.next_cursor is the only way to read past the first 30.

import { ok, serverError, type Logger, type Result } from "@matchday/domain";
import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { buildDriblApiUrl, type DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import {
  driblFixturesApiResponseSchema,
  type DriblFixturesApiResponse,
} from "#crawlers/dribl/external/driblFixture.ts";

/** Safety net against an endless cursor chain — 30 a page, so ~1500 fixtures for one request. */
const maxFixturePages = 50;

export type ListFixturePagesInput = {
  page: FetchPage;
  logger: Logger;
  ids: DriblLeagueIds;
  /** Extra query params, e.g. `{ round: "3" }`. Omit for Dribl's current fixture window. */
  params?: Record<string, string>;
  /** Names this request in logs and validation errors, e.g. "round 3" or "current window". */
  label: string;
};

/** Every page of one fixtures request, in cursor order. An empty array means the request matched
 * no fixtures; empty pages are never returned. */
export async function listFixturePages(
  input: ListFixturePagesInput,
): Promise<Result<DriblFixturesApiResponse[]>> {
  const { page, logger, ids, params = {}, label } = input;

  const responses: DriblFixturesApiResponse[] = [];
  let cursor: string | null = null;
  let pageNumber = 0;

  while (pageNumber < maxFixturePages) {
    pageNumber++;
    const url = buildDriblApiUrl("fixtures", ids, cursor === null ? params : { ...params, cursor });
    const fetched = await browserFetch(page, url);
    if (!fetched.ok) {
      return fetched;
    }

    const parsed = driblFixturesApiResponseSchema.safeParse(fetched.value);
    if (!parsed.success) {
      return serverError(`Failed to validate fixtures response for ${label}`, parsed.error);
    }

    if (parsed.data.data.length === 0) {
      break;
    }

    responses.push(parsed.data);
    logger.debug("crawl.fixturesApi", "fixture page fetched", {
      label,
      page: pageNumber,
      fixtures: parsed.data.data.length,
    });

    cursor = parsed.data.meta?.next_cursor ?? null;
    if (cursor === null) {
      break;
    }
  }

  if (cursor !== null) {
    logger.warn("crawl.fixturesApi", "hit the fixture page cap with more pages available", {
      label,
      maxFixturePages,
    });
  }

  return ok(responses);
}
