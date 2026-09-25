// Season data access: build a query, execute it, return a `Result` of rows. No business rules
// here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type IsoDate, type Result } from "@matchday/domain";
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
 * years from the source (`"2026"`), so they sort chronologically as text — no date column needed.
 * Prefer per-club season resolution where a source's seasons share a year; this is the fallback
 * for callers with no club in hand. */
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
          set: {
            name: values.name,
            // Only overwrite dates when the caller supplies them: a catalog crawl upserts a season
            // by name and must not blank dates an operator set by hand.
            startsOn: values.startsOn,
            endsOn: values.endsOn,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "season",
    values,
  );
}

/** Which season a name resolved to, once we know how many matched. */
export type SeasonDatesWrite =
  | { status: "written"; season: Season }
  | { status: "missing" }
  | { status: "ambiguous"; count: number };

/** Write a season's calendar window, by season name (a year like `"2026"`). Season names aren't
 * unique — two sources can both have a `"2026"` — so an ambiguous name fails rather than
 * updating every match and reporting the first, which would set the wrong season's dates. */
export async function setSeasonDatesByName(
  db: Db,
  name: string,
  startsOn: IsoDate,
  endsOn: IsoDate,
): Promise<Result<SeasonDatesWrite>> {
  const matches = await runQuery(
    () => db.select().from(season).where(eq(season.name, name)).limit(2),
    "Failed to find season by name",
  );
  if (!matches.ok) {
    return matches;
  }
  if (matches.value.length === 0) {
    return ok({ status: "missing" });
  }
  if (matches.value.length > 1) {
    return ok({ status: "ambiguous", count: matches.value.length });
  }

  const updated = await runQuery(
    () =>
      db
        .update(season)
        .set({ startsOn, endsOn, updatedAt: new Date() })
        .where(eq(season.id, matches.value[0].id))
        .returning(),
    "Failed to set season dates",
  );
  if (!updated.ok) {
    return updated;
  }
  return ok({ status: "written", season: updated.value[0] });
}
