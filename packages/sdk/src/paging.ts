// One cursor-following loop, shared by every paged list route, so a consumer never rebuilds
// "fetch, read nextCursor, fetch again" per endpoint.

import { err, ok, unwrap, type FetchOutcome, type Result } from "#result.ts";

/** The wire shape of every paged list response. `nextCursor` is null on the last page. */
export type Page<T> = { data: T[]; nextCursor: string | null };

/** The paging params to send. Shaped to drop straight into `params: { query }`, `cursor` being
 * `undefined` for the first page and the previous `nextCursor` after that. */
export type PageQuery = { cursor: string | undefined; limit: number };

/** Fetches one page. */
export type PageFetcher<T> = (
  query: PageQuery,
  signal: AbortSignal | undefined,
) => Promise<FetchOutcome<Page<T>>>;

/** `limit` is the server's max, so a full walk costs the fewest round-trips. `maxPages` exists only
 * so a server bug can't turn the loop into an endless one — 100 pages is 50k items. */
export const pagingDefaultValue = { limit: 500, maxPages: 100 } as const;

/** Options every `listAll*` helper accepts, on top of its own filters. */
export type PagingInit = {
  /** Aborts the whole walk, not just the page in flight. */
  signal?: AbortSignal;
  /** Items per request. Defaults to 500, the server's max. */
  limit?: number;
  /** Fail rather than page forever. Defaults to 100. */
  maxPages?: number;
};

/**
 * Follows `nextCursor` to the end and returns every item as one array.
 *
 * The caller supplies the request, so this works for any paged route — including ones added after
 * this SDK version, and any filter combination:
 *
 * ```ts
 * const clubs = await fetchAllPages<Club>((query, signal) =>
 *   client.GET("/clubs", { params: { query }, signal }),
 * );
 * ```
 *
 * A failure on any page returns that failure, never a silently partial list.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  init: PagingInit = {},
): Promise<Result<T[]>> {
  const { signal, limit = pagingDefaultValue.limit, maxPages = pagingDefaultValue.maxPages } = init;
  const items: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const result = unwrap(await fetchPage({ cursor, limit }, signal));
    if (!result.ok) {
      return result;
    }

    items.push(...result.value.data);
    if (result.value.nextCursor === null) {
      return ok(items);
    }
    cursor = result.value.nextCursor;
  }

  return err({
    status: 500,
    message: `matchday API returned more than ${maxPages} pages; narrow the query with a filter, or raise maxPages`,
  });
}
