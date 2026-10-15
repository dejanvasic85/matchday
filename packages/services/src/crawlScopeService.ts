// Crawl scope: pick the league the deep crawl should visit for each crawl target. A target is
// season-agnostic, so this chooses the competition's current edition from its calendar window.

import { ok, type IsoDate, type Result } from "@matchday/domain";
import type { CrawlTargetLeagueCandidate, listCrawlTargetLeagueCandidates } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type CrawlScopeDeps = {
  listCrawlTargetLeagueCandidates: WithoutDb<typeof listCrawlTargetLeagueCandidates>;
};

/** A candidate with a league row behind it. */
export type CrawlTargetLeagueEdition = CrawlTargetLeagueCandidate & { leagueId: string };

export type SkippedCrawlTarget = {
  competitionName: string;
  leagueName: string;
};

export type CrawlScope = {
  /** The league ids the deep crawl should visit, deduplicated and sorted. */
  leagueIds: string[];
  /** Targets with no league to crawl, so the caller warns rather than silently crawling nothing. */
  skipped: SkippedCrawlTarget[];
};

function hasLeague(candidate: CrawlTargetLeagueCandidate): candidate is CrawlTargetLeagueEdition {
  return candidate.leagueId !== null;
}

/** True when today falls inside the window. A window with no end date counts as still running. */
function windowIncludes(candidate: CrawlTargetLeagueCandidate, today: IsoDate): boolean {
  return (
    candidate.startsOn !== null &&
    candidate.startsOn <= today &&
    (candidate.endsOn === null || today <= candidate.endsOn)
  );
}

function pickLatest(
  candidates: CrawlTargetLeagueEdition[],
  key: (candidate: CrawlTargetLeagueEdition) => string | null,
): CrawlTargetLeagueEdition {
  return candidates.reduce((best, candidate) =>
    (key(candidate) ?? "") > (key(best) ?? "") ? candidate : best,
  );
}

function pickEarliest(
  candidates: CrawlTargetLeagueEdition[],
  key: (candidate: CrawlTargetLeagueEdition) => string | null,
): CrawlTargetLeagueEdition {
  return candidates.reduce((best, candidate) =>
    (key(candidate) ?? "") < (key(best) ?? "") ? candidate : best,
  );
}

/**
 * The edition to crawl for one target: the running one, else the next one to start, else the latest
 * season by name when no edition has dates. A finished edition is never crawled — between seasons
 * the scope is empty until the catalog crawl creates the next one. Null when nothing is crawlable.
 */
export function selectCurrentLeague(
  candidates: CrawlTargetLeagueCandidate[],
  today: IsoDate,
): CrawlTargetLeagueEdition | null {
  const withLeague = candidates.filter(hasLeague);
  if (withLeague.length === 0) {
    return null;
  }

  const running = withLeague.filter((candidate) => windowIncludes(candidate, today));
  if (running.length > 0) {
    return pickLatest(running, (candidate) => candidate.startsOn);
  }

  const upcoming = withLeague.filter(
    (candidate) => candidate.startsOn !== null && candidate.startsOn > today,
  );
  if (upcoming.length > 0) {
    return pickEarliest(upcoming, (candidate) => candidate.startsOn);
  }

  // Every edition with dates has finished, so there is nothing live to crawl.
  if (withLeague.some((candidate) => candidate.startsOn !== null)) {
    return null;
  }

  return pickLatest(withLeague, (candidate) => candidate.seasonName);
}

/** Resolve every target to the league the deep crawl should visit, grouping the candidate rows by
 * target first so each target is one decision. */
export async function resolveCrawlScope(
  deps: CrawlScopeDeps,
  today: IsoDate,
): Promise<Result<CrawlScope>> {
  const result = await deps.listCrawlTargetLeagueCandidates();
  if (!result.ok) {
    return result;
  }

  const groups = new Map<
    string,
    { competitionName: string; leagueName: string; candidates: CrawlTargetLeagueCandidate[] }
  >();
  for (const row of result.value) {
    const group = groups.get(row.targetId);
    if (group === undefined) {
      groups.set(row.targetId, {
        competitionName: row.competitionName,
        leagueName: row.targetLeagueName,
        candidates: [row],
      });
    } else {
      group.candidates.push(row);
    }
  }

  const leagueIds: string[] = [];
  const skipped: SkippedCrawlTarget[] = [];
  for (const group of groups.values()) {
    const chosen = selectCurrentLeague(group.candidates, today);
    if (chosen === null) {
      skipped.push({ competitionName: group.competitionName, leagueName: group.leagueName });
      continue;
    }
    leagueIds.push(chosen.leagueId);
  }

  return ok({ leagueIds: [...new Set(leagueIds)].sort(), skipped });
}
