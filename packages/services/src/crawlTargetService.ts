// Crawl targets by league id: the add a client makes through the API. A client may widen the crawl
// on purpose, one league at a time, but never narrow it; removal stays an admin task.

import { generateId, notFound, ok, type IsoDate, type Result } from "@matchday/domain";
import type {
  getLeagueById,
  listCrawlTargetLeagueCandidates,
  upsertCrawlTarget,
} from "@matchday/db";
import { selectCurrentLeague } from "#crawlScopeService.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type CrawlTargetServiceDeps = {
  getLeagueById: WithoutDb<typeof getLeagueById>;
  upsertCrawlTarget: WithoutDb<typeof upsertCrawlTarget>;
  listCrawlTargetLeagueCandidates: WithoutDb<typeof listCrawlTargetLeagueCandidates>;
};

export type LeagueCrawlTarget = {
  id: string;
  competitionId: string;
  leagueName: string;
  /** The edition the next crawl visits, or null when none is crawlable yet: between seasons, or
   * when the league was renamed and its old name no longer matches. */
  currentLeagueId: string | null;
};

/**
 * Add the league's competition and name as a crawl target. The target names the league, not its
 * season, so an id from a past edition targets the current one. Adding it again changes nothing.
 */
export async function addCrawlTargetForLeague(
  deps: CrawlTargetServiceDeps,
  leagueId: string,
  today: IsoDate,
): Promise<Result<LeagueCrawlTarget>> {
  const league = await deps.getLeagueById(leagueId);
  if (!league.ok) {
    return league;
  }
  if (league.value === null) {
    return notFound("League not found");
  }

  const upserted = await deps.upsertCrawlTarget({
    id: generateId("crawlTarget"),
    competitionId: league.value.competitionId,
    leagueName: league.value.name,
  });
  if (!upserted.ok) {
    return upserted;
  }

  const candidates = await deps.listCrawlTargetLeagueCandidates();
  if (!candidates.ok) {
    return candidates;
  }
  const current = selectCurrentLeague(
    candidates.value.filter((candidate) => candidate.targetId === upserted.value.id),
    today,
  );

  return ok({
    id: upserted.value.id,
    competitionId: upserted.value.competitionId,
    leagueName: upserted.value.leagueName,
    currentLeagueId: current?.leagueId ?? null,
  });
}
