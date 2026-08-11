// Table entry data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import { asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { tableEntry } from "#schema.ts";

type TableEntry = typeof tableEntry.$inferSelect;
type TableEntryInsert = typeof tableEntry.$inferInsert;

/** A league's ladder, position-ordered (0045, subscription-scoped per ADR 0012). */
export async function listTableEntriesByLeagueId(
  db: Db,
  leagueId: string,
): Promise<Result<TableEntry[]>> {
  return runQuery(
    () =>
      db
        .select()
        .from(tableEntry)
        .where(eq(tableEntry.leagueId, leagueId))
        .orderBy(asc(tableEntry.position)),
    "Failed to list table entries by league id",
  );
}

/**
 * Upsert a table entry by its `(league_id, team_id)` idempotency key: a team appears at most
 * once per league's table, so re-crawling the same league updates the existing row for that
 * team instead of inserting a duplicate. No `external_ref` involved — the whole ladder is
 * re-fetched and replaced each crawl, so there's no stable per-row Dribl id worth tracking.
 */
export async function upsertTableEntry(
  db: Db,
  values: TableEntryInsert,
): Promise<Result<TableEntry>> {
  return runUpsert(
    () =>
      db
        .insert(tableEntry)
        .values(values)
        .onConflictDoUpdate({
          target: [tableEntry.leagueId, tableEntry.teamId],
          set: {
            competitionId: values.competitionId,
            seasonId: values.seasonId,
            position: values.position,
            played: values.played,
            won: values.won,
            drawn: values.drawn,
            lost: values.lost,
            goalsFor: values.goalsFor,
            goalsAgainst: values.goalsAgainst,
            goalDifference: values.goalDifference,
            points: values.points,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "table entry",
    values,
  );
}
