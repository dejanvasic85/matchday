// The wire shape of a paged list, and the one place a `Page` from data access becomes it.

import { mapResult, type Result } from "@matchday/domain";
import type { Page } from "@matchday/db";

/** `nextCursor` is null on the last page — a caller loops until it's null, never needing a count. */
export type PagedResponse<T> = { data: T[]; nextCursor: string | null };

export function mapPage<Row, T>(
  result: Result<Page<Row>>,
  mapRow: (row: Row) => T,
): Result<PagedResponse<T>> {
  return mapResult(result, (page) => ({
    data: page.rows.map(mapRow),
    nextCursor: page.nextCursor,
  }));
}
