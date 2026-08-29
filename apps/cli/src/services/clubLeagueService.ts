// Club -> league resolution: listLeaguesByClubId returns one row per (team, league) pair,
// undeduplicated; dedup is a business rule so it lives here, not in a SQL DISTINCT.

import { ok, type Result } from "@matchday/domain";
import type { listLeaguesByClubId } from "@matchday/db";
import { resolveClub, type ClubResolverDeps, type ResolvedClub } from "#services/clubResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClubLeagueServiceDeps = ClubResolverDeps & {
  listLeaguesByClubId: WithoutDb<typeof listLeaguesByClubId>;
};

export type LeagueSummary = {
  id: string;
  name: string;
};

export type ClubLeagues = {
  club: ResolvedClub;
  leagues: LeagueSummary[];
};

/** Distinct leagues by id, name-ordered — collapses the one-row-per-team duplicates from
 * `listLeaguesByClubId` (a club with 19 teams across 18 leagues has exactly one team sharing a
 * league with another). */
function dedupeLeagues(rows: LeagueSummary[]): LeagueSummary[] {
  const byId = new Map<string, LeagueSummary>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a club by name and list the distinct leagues its teams play in, via league_team
 * (which supersedes table_entry): a league is only discoverable once the catalog crawl has
 * run for it at least once.
 *
 * `seasonId` scopes the result to one season. Without it a club returns every league it has ever
 * played in, across all seasons — right for browsing, wrong for anything that then subscribes. */
export async function listLeaguesForClub(
  deps: ClubLeagueServiceDeps,
  clubName: string,
  seasonId?: string,
): Promise<Result<ClubLeagues>> {
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const leaguesResult = await listLeaguesForClubId(deps, clubResult.value.id, seasonId);
  if (!leaguesResult.ok) {
    return leaguesResult;
  }

  return ok({ club: clubResult.value, leagues: leaguesResult.value });
}

/** The distinct leagues a already-resolved club plays in — the same dedup as
 * {@link listLeaguesForClub} without re-resolving a name, for callers iterating followed clubs. */
export async function listLeaguesForClubId(
  deps: Pick<ClubLeagueServiceDeps, "listLeaguesByClubId">,
  clubId: string,
  seasonId?: string,
): Promise<Result<LeagueSummary[]>> {
  const leaguesResult = await deps.listLeaguesByClubId(clubId, seasonId);
  if (!leaguesResult.ok) {
    return leaguesResult;
  }
  return ok(dedupeLeagues(leaguesResult.value));
}
