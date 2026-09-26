// Competition data access: build a query, execute it, return a `Result` of rows. No business
// rules here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition, competitionSeason } from "#schema.ts";

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

/** Competitions with an exact name that already have a window in the given season, so an operator
 * setting dates can only target a competition that actually runs that season. Returns every match
 * so a caller can fail on ambiguity rather than pick one. */
export async function findCompetitionsForSeasonByName(
  db: Db,
  seasonId: string,
  name: string,
): Promise<Result<Competition[]>> {
  const result = await runQuery(
    () =>
      db
        .selectDistinct({
          id: competition.id,
          name: competition.name,
          createdAt: competition.createdAt,
          updatedAt: competition.updatedAt,
        })
        .from(competition)
        .innerJoin(competitionSeason, eq(competitionSeason.competitionId, competition.id))
        .where(and(eq(competitionSeason.seasonId, seasonId), eq(competition.name, name))),
    "Failed to find competitions for season by name",
  );
  return result.ok ? ok(result.value) : result;
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
