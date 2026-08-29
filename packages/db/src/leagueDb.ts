// League data access: build a query, execute it, return a `Result` of rows. No business rules
// here (AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "#client.ts";
import { decodeCursor, resolveLimit, toPage, type Page, type PageRequest } from "#paging.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition, league, leagueTeam, season, team } from "#schema.ts";

type League = typeof league.$inferSelect;
type LeagueInsert = typeof league.$inferInsert;
type Competition = typeof competition.$inferSelect;
type Season = typeof season.$inferSelect;

/** A league with its competition and season embedded. Both are `notNull` FKs, so the inner joins
 * below can't drop a league and neither side is nullable — unlike `TeamWithClub`. */
export type LeagueWithRefs = League & { competition: Competition; season: Season };

export type ListLeaguesFilter = { competitionId?: string; seasonId?: string; clubId?: string };

/** Selecting each joined table as a whole under its own key is what makes drizzle nest it as one
 * object, instead of flattening its columns in among the league's. */
const leagueSelection = {
  id: league.id,
  name: league.name,
  competitionId: league.competitionId,
  seasonId: league.seasonId,
  hasTable: league.hasTable,
  createdAt: league.createdAt,
  updatedAt: league.updatedAt,
  competition,
  season,
};

/**
 * List leagues, optionally narrowed to a competition, season, and/or club — the cascading-dropdown
 * filter (competition -> season -> league) onboarding needs, plus `clubId` for "leagues
 * this club's teams play in" (a consumer picking which league to bind a team page's display to).
 *
 * `clubId` isn't a column on `league` — it's derived via `team`/`league_team`, the same join
 * `listLeaguesByClubId` below uses — so it only joins those tables when asked for. A club with two
 * teams in the same league would otherwise duplicate that league one row per team; `selectDistinct`
 * collapses that safely (unlike `listLeaguesByClubId`'s dedup, this isn't a business decision — the
 * duplicate rows are byte-for-byte identical, nothing to pick between).
 */
export async function listLeagues(
  db: Db,
  filter: ListLeaguesFilter = {},
  page: PageRequest = {},
): Promise<Result<Page<LeagueWithRefs>>> {
  const { competitionId, seasonId, clubId } = filter;
  const limit = resolveLimit(page.limit);
  const after = page.cursor === undefined ? undefined : decodeCursor(page.cursor);
  if (after !== undefined && !after.ok) {
    return after;
  }

  const conditions = [
    competitionId !== undefined ? eq(league.competitionId, competitionId) : undefined,
    seasonId !== undefined ? eq(league.seasonId, seasonId) : undefined,
    clubId !== undefined ? eq(team.clubId, clubId) : undefined,
    after !== undefined ? gt(league.id, after.value) : undefined,
  ].filter((condition) => condition !== undefined);

  const where = conditions.length === 0 ? undefined : and(...conditions);

  const result = await runQuery(
    () =>
      clubId === undefined
        ? db
            .select(leagueSelection)
            .from(league)
            .innerJoin(competition, eq(competition.id, league.competitionId))
            .innerJoin(season, eq(season.id, league.seasonId))
            .where(where)
            .orderBy(asc(league.id))
            .limit(limit + 1)
        : db
            .selectDistinct(leagueSelection)
            .from(league)
            .innerJoin(competition, eq(competition.id, league.competitionId))
            .innerJoin(season, eq(season.id, league.seasonId))
            .innerJoin(leagueTeam, eq(leagueTeam.leagueId, league.id))
            .innerJoin(team, eq(team.id, leagueTeam.teamId))
            .where(where)
            .orderBy(asc(league.id))
            .limit(limit + 1),
    "Failed to list leagues",
  );
  return result.ok ? ok(toPage(result.value, limit)) : result;
}

/**
 * Every league a club's teams play in, via `league_team` rather than `table_entry` or
 * `fixture`. `table_entry` only exists for leagues with a published ladder — table-less divisions
 * (e.g. MiniRoos age groups, which publish fixtures but no standings) have no `table_entry` row,
 * so a club with MiniRoos teams was silently missing those leagues here. `fixture` under-subscribes
 * for a different reason: the deep crawl's fixture backlog only covers a couple of leagues.
 * `league_team` is written for every team the catalog crawl discovers regardless of
 * which path found it, so it has neither gap. One row per (team, league) pair — a club with two
 * teams in the same league returns that league twice, deliberately undeduplicated so the caller
 * (clubLeagueService, business logic) does the dedup and stays unit-testable rather than hiding
 * that rule in SQL.
 *
 * Depends on the catalog crawl having already run for a league before it's discoverable here: fine
 * for onboarding a club into an existing dataset, circular for a brand-new league.
 */
export async function listLeaguesByClubId(
  db: Db,
  clubId: string,
): Promise<Result<LeagueWithRefs[]>> {
  return runQuery(
    () =>
      db
        .select(leagueSelection)
        .from(league)
        .innerJoin(competition, eq(competition.id, league.competitionId))
        .innerJoin(season, eq(season.id, league.seasonId))
        .innerJoin(leagueTeam, eq(leagueTeam.leagueId, league.id))
        .innerJoin(team, eq(team.id, leagueTeam.teamId))
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
            hasTable: values.hasTable,
            updatedAt: new Date(),
          },
        })
        .returning(),
    "league",
    values,
  );
}

export async function getLeagueById(db: Db, id: string): Promise<Result<LeagueWithRefs | null>> {
  const result = await runQuery(
    () =>
      db
        .select(leagueSelection)
        .from(league)
        .innerJoin(competition, eq(competition.id, league.competitionId))
        .innerJoin(season, eq(season.id, league.seasonId))
        .where(eq(league.id, id))
        .limit(1),
    "Failed to get league by id",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
