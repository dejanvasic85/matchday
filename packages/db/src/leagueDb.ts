// League data access: build a query, execute it, return a `Result` of rows. No business rules
// here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { league, tableEntry, team } from "#schema.ts";

type League = typeof league.$inferSelect;
type LeagueInsert = typeof league.$inferInsert;

export type ListLeaguesFilter = { competitionId?: string; seasonId?: string; clubId?: string };

/** Every column `listLeagues` returns, named explicitly so the `clubId`-filtered branch below
 * (which must join through `table_entry`/`team`) still yields plain `League` rows rather than
 * drizzle's per-table nested shape a join produces from an unqualified `.select()`. */
const leagueColumns = {
  id: league.id,
  name: league.name,
  competitionId: league.competitionId,
  seasonId: league.seasonId,
  createdAt: league.createdAt,
  updatedAt: league.updatedAt,
};

/**
 * List leagues, optionally narrowed to a competition, season, and/or club — the cascading-dropdown
 * filter (competition -> season -> league) onboarding needs (0012), plus `clubId` for "leagues
 * this club's teams play in" (a consumer picking which league to bind a team page's display to).
 *
 * `clubId` isn't a column on `league` — it's derived via `team`/`table_entry`, the same join
 * `listLeaguesByClubId` below uses — so it only joins those tables when asked for, keeping the
 * competition/season-only case (today's only caller) a single-table query. A club with two teams
 * in the same league would otherwise duplicate that league one row per team; `selectDistinct` on
 * league-only columns collapses that safely (unlike `listLeaguesByClubId`'s dedup, this isn't a
 * business decision — the duplicate rows are byte-for-byte identical, nothing to pick between).
 */
export async function listLeagues(
  db: Db,
  filter: ListLeaguesFilter = {},
): Promise<Result<League[]>> {
  const { competitionId, seasonId, clubId } = filter;
  const conditions = [
    competitionId !== undefined ? eq(league.competitionId, competitionId) : undefined,
    seasonId !== undefined ? eq(league.seasonId, seasonId) : undefined,
    clubId !== undefined ? eq(team.clubId, clubId) : undefined,
  ].filter((condition) => condition !== undefined);

  if (clubId === undefined) {
    return runQuery(
      () =>
        conditions.length === 0
          ? db.select().from(league)
          : db
              .select()
              .from(league)
              .where(and(...conditions)),
      "Failed to list leagues",
    );
  }

  return runQuery(
    () =>
      db
        .selectDistinct(leagueColumns)
        .from(league)
        .innerJoin(tableEntry, eq(tableEntry.leagueId, league.id))
        .innerJoin(team, eq(team.id, tableEntry.teamId))
        .where(and(...conditions))
        .orderBy(asc(league.name)),
    "Failed to list leagues",
  );
}

/**
 * Every league a club's teams play in, via `table_entry` rather than `fixture` (#85: prod has
 * table entries for every team, but the deep crawl's fixture backlog only covers a couple of
 * leagues, so the fixture path silently under-subscribes). One row per (team, league) pair — a
 * club with two teams in the same league returns that league twice, deliberately undeduplicated
 * so the caller (clubLeagueService, business logic) does the dedup and stays unit-testable rather
 * than hiding that rule in SQL.
 *
 * Depends on the deep crawl having already run for a league before it's discoverable here: fine
 * for onboarding a club into an existing dataset, circular for a brand-new league.
 */
export async function listLeaguesByClubId(db: Db, clubId: string): Promise<Result<League[]>> {
  return runQuery(
    () =>
      db
        .select({
          id: league.id,
          name: league.name,
          competitionId: league.competitionId,
          seasonId: league.seasonId,
          createdAt: league.createdAt,
          updatedAt: league.updatedAt,
        })
        .from(league)
        .innerJoin(tableEntry, eq(tableEntry.leagueId, league.id))
        .innerJoin(team, eq(team.id, tableEntry.teamId))
        .where(eq(team.clubId, clubId))
        .orderBy(asc(league.name)),
    "Failed to list leagues by club id",
  );
}

export async function upsertLeague(db: Db, values: LeagueInsert): Promise<Result<League>> {
  return runUpsert(
    () =>
      db
        .insert(league)
        .values(values)
        .onConflictDoUpdate({
          target: league.id,
          set: {
            name: values.name,
            competitionId: values.competitionId,
            seasonId: values.seasonId,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "league",
    values,
  );
}

export async function getLeagueById(db: Db, id: string): Promise<Result<League | null>> {
  const result = await runQuery(
    () => db.select().from(league).where(eq(league.id, id)).limit(1),
    "Failed to get league by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
