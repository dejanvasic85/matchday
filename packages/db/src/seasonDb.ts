// Season data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runUpsert } from "./runQuery.ts";
import { season } from "./schema.ts";

type Season = typeof season.$inferSelect;
type SeasonInsert = typeof season.$inferInsert;

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
