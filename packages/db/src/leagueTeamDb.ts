// League team (membership) data access: build/execute a query, return a `Result` of rows.
// No business rules here.

import { ok, type Result } from "@matchday/domain";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { leagueTeam, team } from "#schema.ts";

type LeagueTeam = typeof leagueTeam.$inferSelect;
type LeagueTeamInsert = typeof leagueTeam.$inferInsert;

/** Upsert a league-team membership row by its `(league_id, team_id)` key. Called for every team
 * the catalog crawl discovers — independent of `table_entry`, which needs a published ladder. */
export async function upsertLeagueTeam(
  db: Db,
  values: LeagueTeamInsert,
): Promise<Result<LeagueTeam>> {
  return runUpsert(
    () =>
      db
        .insert(leagueTeam)
        .values(values)
        .onConflictDoUpdate({
          target: [leagueTeam.leagueId, leagueTeam.teamId],
          set: { updatedAt: new Date() },
        })
        .returning(),
    "league team",
    values,
  );
}

/** The distinct clubs fielding a team in a league — how the crawl turns "this league changed"
 * into "these clients' followed clubs care". Teams we haven't resolved to a club yet
 * (`team.clubId` is nullable) are excluded rather than returned as nulls. */
export async function listClubIdsByLeagueId(db: Db, leagueId: string): Promise<Result<string[]>> {
  const result = await runQuery(
    () =>
      db
        .selectDistinct({ clubId: team.clubId })
        .from(leagueTeam)
        .innerJoin(team, eq(team.id, leagueTeam.teamId))
        .where(and(eq(leagueTeam.leagueId, leagueId), isNotNull(team.clubId))),
    "Failed to list club ids by league id",
  );
  if (!result.ok) {
    return result;
  }
  return ok(result.value.flatMap((row) => (row.clubId === null ? [] : [row.clubId])));
}
