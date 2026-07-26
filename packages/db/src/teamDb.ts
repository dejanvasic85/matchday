// Team data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runUpsert } from "./runQuery.ts";
import { team } from "./schema.ts";

type Team = typeof team.$inferSelect;
type TeamInsert = typeof team.$inferInsert;

export async function upsertTeam(db: Db, values: TeamInsert): Promise<Result<Team>> {
  return runUpsert(
    () =>
      db
        .insert(team)
        .values(values)
        .onConflictDoUpdate({
          target: team.id,
          set: {
            clubId: values.clubId,
            name: values.name,
            ageGroup: values.ageGroup ?? null,
            gender: values.gender ?? null,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "team",
    values,
  );
}
