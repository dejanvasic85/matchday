// Competition data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { runQuery, runUpsert } from "./runQuery.ts";
import { competition } from "./schema.ts";

type Competition = typeof competition.$inferSelect;
type CompetitionInsert = typeof competition.$inferInsert;

export async function listCompetitions(db: Db): Promise<Result<Competition[]>> {
  return runQuery(() => db.select().from(competition), "Failed to list competitions");
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
