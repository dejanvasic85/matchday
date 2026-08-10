// Club -> league resolution (#85): "which leagues do this club's teams actually play in?" —
// business logic lives here (AGENTS.md) so it's unit-testable with fakes.
//
// packages/db's listLeaguesByClubId deliberately returns one row per (team, league) pair,
// undeduplicated — a club with two teams in the same league gets that league twice. Dedup is a
// business rule (which of the duplicate rows' fields wins, if they ever differ), so it lives here
// rather than in a SQL DISTINCT, keeping it unit-testable instead of only verifiable against a
// live database.

import { ok, type Result } from "@matchday/domain";
import type { listLeaguesByClubId } from "@matchday/db";
import { resolveClub, type ClubResolverDeps, type ResolvedClub } from "./clubResolver.ts";

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

/** Resolve a club by name and list the distinct leagues its teams play in, via table_entry (#85):
 * a league is only discoverable once the deep crawl has run for it at least once. */
export async function listLeaguesForClub(
  deps: ClubLeagueServiceDeps,
  clubName: string,
): Promise<Result<ClubLeagues>> {
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const leaguesResult = await deps.listLeaguesByClubId(clubResult.value.id);
  if (!leaguesResult.ok) {
    return leaguesResult;
  }

  return ok({
    club: clubResult.value,
    leagues: dedupeLeagues(leaguesResult.value),
  });
}
