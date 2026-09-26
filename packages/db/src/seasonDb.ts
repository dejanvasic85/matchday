// Season data access: build a query, execute it, return a `Result` of rows. No business rules
// here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result, type Source } from "@matchday/domain";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { season } from "#schema.ts";

type Season = typeof season.$inferSelect;
type SeasonInsert = typeof season.$inferInsert;

export type ListSeasonsFilter = { source?: Source };

/** Keyset-paged on `id`: ordered by primary key, seeking past the cursor. */
export async function listSeasons(
  db: Db,
  filter: ListSeasonsFilter = {},
  page: PageRequest = {},
): Promise<Result<Page<Season>>> {
  const limit = resolveLimit(page.limit);
  const after = page.cursor === undefined ? undefined : decodeCursor(page.cursor);
  if (after !== undefined && !after.ok) {
    return after;
  }

  const conditions = [
    filter.source === undefined ? undefined : eq(season.source, filter.source),
    after === undefined ? undefined : gt(season.id, after.value),
  ].filter((condition) => condition !== undefined);

  const result = await runQuery(
    () =>
      db
        .select()
        .from(season)
        .where(conditions.length === 0 ? undefined : and(...conditions))
        .orderBy(asc(season.id))
        .limit(limit + 1),
    "Failed to list seasons",
  );
  return result.ok ? ok(toPage(result.value, limit)) : result;
}

/** The most recent season for a source, by name — or `null` when it has none yet. Names are the
 * source's own labels, ordered as text, so a plain year (`"2026"` before `"2027"`) is chronological
 * and a label like `"2026 Spring"` simply orders alphabetically. Scoped to one source: a name from
 * another source must never become the target. */
export async function findLatestSeason(db: Db, source: Source): Promise<Result<Season | null>> {
  const result = await runQuery(
    () =>
      db.select().from(season).where(eq(season.source, source)).orderBy(desc(season.name)).limit(1),
    "Failed to find latest season",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Look up a season by its source and exact name, or `null` when the catalog crawl hasn't created
 * it yet — so `--season` reports an uncrawled year rather than silently matching nothing. */
export async function findSeasonByName(
  db: Db,
  source: Source,
  name: string,
): Promise<Result<Season | null>> {
  const result = await runQuery(
    () =>
      db
        .select()
        .from(season)
        .where(and(eq(season.source, source), eq(season.name, name)))
        .limit(1),
    "Failed to find season by name",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

export async function getSeasonById(db: Db, id: string): Promise<Result<Season | null>> {
  const result = await runQuery(
    () => db.select().from(season).where(eq(season.id, id)).limit(1),
    "Failed to get season by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

export async function upsertSeason(db: Db, values: SeasonInsert): Promise<Result<Season>> {
  return runUpsert(
    () =>
      db
        .insert(season)
        .values(values)
        .onConflictDoUpdate({
          target: season.id,
          set: {
            source: values.source,
            name: values.name,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "season",
    values,
  );
}
