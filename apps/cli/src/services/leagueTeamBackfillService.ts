// One-off league_team backfill (#143): populates league_team for leagues crawled before #142's
// dual-write shipped. table_entry's unique index guarantees no dedup needed. Idempotent.

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
    // Sequential, not Promise.all: a failure should stop the run, not fire remaining upserts
    // concurrently (same reasoning as createSubscriptionsForClub's loop).
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
