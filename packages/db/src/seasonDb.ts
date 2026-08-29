// Season data access: build a query, execute it, return a `Result` of rows. No business rules
// here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { asc, desc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { season } from "#schema.ts";

type Season = typeof season.$inferSelect;
type SeasonInsert = typeof season.$inferInsert;

/** Keyset-paged on `id`: ordered by primary key, seeking past the cursor. */
export async function listSeasons(db: Db, page: PageRequest = {}): Promise<Result<Page<Season>>> {
  const limit = resolveLimit(page.limit);
  const after = page.cursor === undefined ? undefined : decodeCursor(page.cursor);
  if (after !== undefined && !after.ok) {
    return after;
  }

  const result = await runQuery(
    () =>
      db
        .select()
        .from(season)
        .where(after === undefined ? undefined : gt(season.id, after.value))
        .orderBy(asc(season.id))
        .limit(limit + 1),
    "Failed to list seasons",
  );
  return result.ok ? ok(toPage(result.value, limit)) : result;
}

/** The most recent season by name, or `null` when none exist yet. Season names are four-digit
 * years from the source (`"2026"`), so they sort chronologically as text — no date column needed. */
export async function findLatestSeason(db: Db): Promise<Result<Season | null>> {
  const result = await runQuery(
    () => db.select().from(season).orderBy(desc(season.name)).limit(1),
    "Failed to find latest season",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Look up a season by its exact name (a year like `"2027"`), or `null` when the catalog crawl
 * hasn't created it yet — so `--season` reports an uncrawled year rather than silently matching
 * nothing. */
export async function findSeasonByName(db: Db, name: string): Promise<Result<Season | null>> {
  const result = await runQuery(
    () => db.select().from(season).where(eq(season.name, name)).limit(1),
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
          set: { name: values.name, updatedAt: new Date() },
        })
        .returning(),
    "season",
    values,
  );
}
