// League team (membership) data access: build/execute a query, return a `Result` of rows.
// No business rules here.

import type { Result } from "@matchday/domain";
import type { Db } from "#client.ts";
import { runUpsert } from "#runQuery.ts";
import { leagueTeam } from "#schema.ts";

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
