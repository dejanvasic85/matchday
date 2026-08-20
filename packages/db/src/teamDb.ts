// Team data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { team } from "#schema.ts";

type Team = typeof team.$inferSelect;
type TeamInsert = typeof team.$inferInsert;

/** List teams, optionally narrowed to one club — the filter a club's roster page needs. */
export async function listTeams(db: Db, clubId?: string): Promise<Result<Team[]>> {
  return runQuery(
    () =>
      clubId === undefined
        ? db.select().from(team)
        : db.select().from(team).where(eq(team.clubId, clubId)),
    "Failed to list teams",
  );
}

export async function getTeamById(db: Db, id: string): Promise<Result<Team | null>> {
  const result = await runQuery(
    () => db.select().from(team).where(eq(team.id, id)).limit(1),
    "Failed to get team by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

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
            updatedAt: new Date(),
          },
        })
        .returning(),
    "team",
    values,
  );
}
