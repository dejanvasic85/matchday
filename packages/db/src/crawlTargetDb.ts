// Crawl-target data access: the leagues the system crawls. Build a query, execute it, return a
// `Result` of rows. No business rules here (AGENTS.md).

import { ok, type IsoDate, type Result } from "@matchday/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition, competitionSeason, crawlTarget, league, season } from "#schema.ts";

type CrawlTarget = typeof crawlTarget.$inferSelect;
export type CrawlTargetInsert = typeof crawlTarget.$inferInsert;

/** A target joined to its competition, so `mday crawl-target list` shows names rather than ids. */
export type CrawlTargetWithCompetition = {
  id: string;
  competitionId: string;
  competitionName: string;
  leagueName: string;
};

/** Upsert a target by `(competition_id, league_name)`: the same league is targeted at most once, so
 * re-adding the pair is idempotent rather than a duplicate. */
export async function upsertCrawlTarget(
  db: Db,
  values: CrawlTargetInsert,
): Promise<Result<CrawlTarget>> {
  return runUpsert(
    () =>
      db
        .insert(crawlTarget)
        .values(values)
        .onConflictDoUpdate({
          target: [crawlTarget.competitionId, crawlTarget.leagueName],
          set: { updatedAt: new Date() },
        })
        .returning(),
    "crawl target",
    values,
  );
}

/** Every target with its competition, competition-then-league ordered. Small enough (one row per
 * crawled league) to return unpaged. */
export async function listCrawlTargets(db: Db): Promise<Result<CrawlTargetWithCompetition[]>> {
  const result = await runQuery(
    () =>
      db
        .select({
          id: crawlTarget.id,
          competitionId: crawlTarget.competitionId,
          competitionName: competition.name,
          leagueName: crawlTarget.leagueName,
        })
        .from(crawlTarget)
        .innerJoin(competition, eq(competition.id, crawlTarget.competitionId))
        .orderBy(asc(competition.name), asc(crawlTarget.leagueName)),
    "Failed to list crawl targets",
  );
  return result.ok ? ok(result.value) : result;
}

/** One crawl target's candidate leagues: one row per season that has a league with the target's
 * name, with the competition's calendar window. A target with no matching league still appears, with
 * `leagueId` null, so the crawl can warn about it rather than drop it silently. */
export type CrawlTargetLeagueCandidate = {
  targetId: string;
  competitionId: string;
  competitionName: string;
  /** The name stored on the target. */
  targetLeagueName: string;
  leagueId: string | null;
  leagueName: string | null;
  seasonId: string | null;
  seasonName: string | null;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
};

/** Every target's candidate leagues, so the crawl scope can pick each target's current edition. The
 * league and its window are left-joined: a target whose name matches no league still returns one row
 * with nulls, which the caller warns about rather than dropping silently. */
export async function listCrawlTargetLeagueCandidates(
  db: Db,
): Promise<Result<CrawlTargetLeagueCandidate[]>> {
  const result = await runQuery(
    () =>
      db
        .select({
          targetId: crawlTarget.id,
          competitionId: crawlTarget.competitionId,
          competitionName: competition.name,
          targetLeagueName: crawlTarget.leagueName,
          leagueId: league.id,
          leagueName: league.name,
          seasonId: league.seasonId,
          seasonName: season.name,
          startsOn: competitionSeason.startsOn,
          endsOn: competitionSeason.endsOn,
        })
        .from(crawlTarget)
        .innerJoin(competition, eq(competition.id, crawlTarget.competitionId))
        .leftJoin(
          league,
          and(
            eq(league.competitionId, crawlTarget.competitionId),
            eq(league.name, crawlTarget.leagueName),
          ),
        )
        .leftJoin(season, eq(season.id, league.seasonId))
        .leftJoin(
          competitionSeason,
          and(
            eq(competitionSeason.competitionId, crawlTarget.competitionId),
            eq(competitionSeason.seasonId, league.seasonId),
          ),
        )
        .orderBy(asc(crawlTarget.id), asc(season.name)),
    "Failed to list crawl target league candidates",
  );
  return result.ok ? ok(result.value) : result;
}

/** Delete a target by id, returning the removed row — or `null` when no such id existed, so the
 * caller can report "not found" rather than a silent no-op. */
export async function deleteCrawlTargetById(
  db: Db,
  id: string,
): Promise<Result<CrawlTarget | null>> {
  const result = await runQuery(
    () => db.delete(crawlTarget).where(eq(crawlTarget.id, id)).returning(),
    "Failed to delete crawl target",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}

/** Delete a target by its `(competition_id, league_name)` key, returning the removed row or `null`. */
export async function deleteCrawlTargetByLeague(
  db: Db,
  competitionId: string,
  leagueName: string,
): Promise<Result<CrawlTarget | null>> {
  const result = await runQuery(
    () =>
      db
        .delete(crawlTarget)
        .where(
          and(eq(crawlTarget.competitionId, competitionId), eq(crawlTarget.leagueName, leagueName)),
        )
        .returning(),
    "Failed to delete crawl target",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
