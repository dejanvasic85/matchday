// One-off league_team backfill (#143): the crawler dual-write (#142) only populates league_team
// going forward, so every league crawled before it shipped has no league_team row yet. Every
// table_entry row already is a distinct (league_id, team_id) pair (table_entry's own unique
// index guarantees that), so the backfill is just "upsert a league_team row for each one" — no
// dedup step needed here. Idempotent: safe to re-run if it's interrupted partway.

import { generateId, ok, type Result } from "@matchday/domain";
import type { listTableEntryTeamPairs, upsertLeagueTeam } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type LeagueTeamBackfillDeps = {
  listTableEntryTeamPairs: WithoutDb<typeof listTableEntryTeamPairs>;
  upsertLeagueTeam: WithoutDb<typeof upsertLeagueTeam>;
};

export type LeagueTeamBackfillResult = {
  pairs: number;
  upserted: number;
};

export async function backfillLeagueTeams(
  deps: LeagueTeamBackfillDeps,
  dryRun: boolean,
): Promise<Result<LeagueTeamBackfillResult>> {
  const pairsResult = await deps.listTableEntryTeamPairs();
  if (!pairsResult.ok) {
    return pairsResult;
  }
  const pairs = pairsResult.value;

  if (dryRun) {
    return ok({ pairs: pairs.length, upserted: 0 });
  }

  let upserted = 0;
  for (const pair of pairs) {
    // Sequential, not Promise.all: a failure partway should stop where it is, leaving every pair
    // upserted so far committed, rather than firing every remaining upsert concurrently once one
    // has already failed (same reasoning as createSubscriptionsForClub's loop).
    const result = await deps.upsertLeagueTeam({
      id: generateId("leagueTeam"),
      leagueId: pair.leagueId,
      teamId: pair.teamId,
    });
    if (!result.ok) {
      return result;
    }
    upserted += 1;
  }

  return ok({ pairs: pairs.length, upserted });
}
