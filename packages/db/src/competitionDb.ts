// Competition data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runUpsert } from "./runQuery.ts";
import { competition } from "./schema.ts";

type Competition = typeof competition.$inferSelect;
type CompetitionInsert = typeof competition.$inferInsert;

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
