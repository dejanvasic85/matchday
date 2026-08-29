// Competition data access: build a query, execute it, return a `Result` of rows. No business
// rules here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { asc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition } from "#schema.ts";

type Competition = typeof competition.$inferSelect;
type CompetitionInsert = typeof competition.$inferInsert;

/** Keyset-paged on `id`: ordered by primary key, seeking past the cursor. */
export async function listCompetitions(
  db: Db,
  page: PageRequest = {},
): Promise<Result<Page<Competition>>> {
  const limit = resolveLimit(page.limit);
  const after = page.cursor === undefined ? undefined : decodeCursor(page.cursor);
  if (after !== undefined && !after.ok) {
    return after;
  }

  const result = await runQuery(
    () =>
      db
        .select()
        .from(competition)
        .where(after === undefined ? undefined : gt(competition.id, after.value))
        .orderBy(asc(competition.id))
        .limit(limit + 1),
    "Failed to list competitions",
  );
  return result.ok ? ok(toPage(result.value, limit)) : result;
}

export async function getCompetitionById(db: Db, id: string): Promise<Result<Competition | null>> {
  const result = await runQuery(
    () => db.select().from(competition).where(eq(competition.id, id)).limit(1),
    "Failed to get competition by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

export async function upsertCompetition(
  db: Db,
  values: CompetitionInsert,
): Promise<Result<Competition>> {
  return runUpsert(
    () =>
      db
        .insert(competition)
        .values(values)
        .onConflictDoUpdate({
          target: competition.id,
          set: { name: values.name, updatedAt: new Date() },
        })
        .returning(),
    "competition",
    values,
  );
}
