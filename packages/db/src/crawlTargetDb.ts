// Crawl-target data access: the leagues the system crawls. Build a query, execute it, return a
// `Result` of rows. No business rules here (AGENTS.md).

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { competition, crawlTarget } from "#schema.ts";

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
