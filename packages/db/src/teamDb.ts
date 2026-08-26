// Team data access: build a query, execute it, return a `Result` of rows. No business rules here
// (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { club, leagueTeam, team } from "#schema.ts";

type Team = typeof team.$inferSelect;
type TeamInsert = typeof team.$inferInsert;
type Club = typeof club.$inferSelect;

export type TeamWithClub = Team & { club: Club | null };

/** Every team column `listTeams`/`getTeamById`/`listTeamsByLeagueId` select, named explicitly
 * (rather than `team.*`) so the `club` join below can sit alongside them in one flat result
 * shape. Selecting the whole `club` table under its own key is what makes Drizzle collapse it to
 * `null` on an unmatched left join, instead of an object of all-null columns. */
const teamColumns = {
  id: team.id,
  clubId: team.clubId,
  name: team.name,
  createdAt: team.createdAt,
  updatedAt: team.updatedAt,
};

/** List teams, optionally narrowed to one club — the filter a club's roster page needs. Each
 * team's owning club is embedded (null if `clubId` is null) so a consumer can render a team
 * without a second request. Keyset-paged on `id` (#164): unscoped this is ~6500 rows / 2.4 MB. */
export async function listTeams(
  db: Db,
  clubId?: string,
  page: PageRequest = {},
): Promise<Result<Page<TeamWithClub>>> {
  const limit = resolveLimit(page.limit);
  const after = page.cursor === undefined ? undefined : decodeCursor(page.cursor);
  if (after !== undefined && !after.ok) {
    return after;
  }

  const conditions = [
    clubId === undefined ? undefined : eq(team.clubId, clubId),
    after === undefined ? undefined : gt(team.id, after.value),
  ].filter((condition) => condition !== undefined);

  const result = await runQuery(
    () =>
      db
        .select({ ...teamColumns, club })
        .from(team)
        .leftJoin(club, eq(team.clubId, club.id))
        .where(conditions.length === 0 ? undefined : and(...conditions))
        .orderBy(asc(team.id))
        .limit(limit + 1),
    "Failed to list teams",
  );
  return result.ok ? ok(toPage(result.value, limit)) : result;
}

export async function getTeamById(db: Db, id: string): Promise<Result<TeamWithClub | null>> {
  const result = await runQuery(
    () =>
      db
        .select({ ...teamColumns, club })
        .from(team)
        .leftJoin(club, eq(team.clubId, club.id))
        .where(eq(team.id, id))
        .limit(1),
    "Failed to get team by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Every team in a league, via the `league_team` membership table (#141/#145) — works for
 * table-less leagues (e.g. MiniRoos) too, unlike deriving membership from `table_entry`. */
export async function listTeamsByLeagueId(
  db: Db,
  leagueId: string,
): Promise<Result<TeamWithClub[]>> {
  return runQuery(
    () =>
      db
        .select({ ...teamColumns, club })
        .from(leagueTeam)
        .innerJoin(team, eq(team.id, leagueTeam.teamId))
        .leftJoin(club, eq(team.clubId, club.id))
        .where(eq(leagueTeam.leagueId, leagueId)),
    "Failed to list teams by league id",
  );
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
