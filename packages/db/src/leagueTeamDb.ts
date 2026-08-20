// League team (membership) data access: build a query, execute it, return a `Result` of rows.
// No business rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than
// thrown.

import type { Result } from "@matchday/domain";
import type { Db } from "#client.ts";
import { runUpsert } from "#runQuery.ts";
import { leagueTeam } from "#schema.ts";

type LeagueTeam = typeof leagueTeam.$inferSelect;
type LeagueTeamInsert = typeof leagueTeam.$inferInsert;

/**
 * Upsert a league-team membership row by its `(league_id, team_id)` idempotency key: a team
 * belongs to a league at most once, so re-crawling the same league/team pair updates the
 * existing row instead of inserting a duplicate. Intended to be called for every team the catalog
 * crawl discovers, table-based or fixture-fallback (wired up in #142) — independent of
 * `table_entry`, which only exists for leagues with a published ladder.
 */
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
