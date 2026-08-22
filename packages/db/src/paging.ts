// Keyset paging shared by every list query. Keyed on `id` alone — prefixed nanoids are unique and
// already the primary key, so a page seek rides the PK index and needs no new one.

import { badRequest, ok, type Result } from "@matchday/domain";

export const pagingLimitValue = {
  default: 100,
  max: 500,
} as const;

export type PageRequest = { limit?: number; cursor?: string };

export type Page<T> = { rows: T[]; nextCursor: string | null };

/** Opaque to callers so the keyset can change without breaking anyone holding an old cursor —
 * they'd get a 400 rather than silently wrong pages. */
export function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): Result<string> {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (decoded === "" || encodeCursor(decoded) !== cursor) {
    return badRequest(`Invalid cursor: ${cursor}`);
  }
  return ok(decoded);
}

/** Clamps rather than rejecting an out-of-range limit: a caller asking for 10000 wants "as many as
 * you'll give me", and failing them mid-crawl helps nobody. */
export function resolveLimit(limit?: number): number {
  if (limit === undefined) {
    return pagingLimitValue.default;
  }
  return Math.min(Math.max(1, Math.trunc(limit)), pagingLimitValue.max);
}

/** Queries fetch `limit + 1` rows; the extra one is what proves another page exists without a
 * second count query. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) {
    return { rows, nextCursor: null };
  }
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: last ? encodeCursor(last.id) : null };
}
