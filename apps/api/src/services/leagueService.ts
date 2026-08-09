// League service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to
// the wire shape (timestamps as ISO strings) and lists/fetches leagues. Catalog data — open to
// any authenticated client, no subscription scoping (ADR 0013). Fixtures/tables (the subscription
// scoped resources) are a separate follow-up.

import { mapResult, type League, type Result } from "@matchday/domain";
import type { getLeagueById, ListLeaguesFilter, listLeagues } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type LeagueServiceDeps = {
  listLeagues: WithoutDb<typeof listLeagues>;
  getLeagueById: WithoutDb<typeof getLeagueById>;
};

export type LeagueResponse = Omit<League, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToLeagueResponse(league: League): LeagueResponse {
  return {
    ...league,
    createdAt: league.createdAt.toISOString(),
    updatedAt: league.updatedAt.toISOString(),
  };
}

export async function listAllLeagues(
  deps: Pick<LeagueServiceDeps, "listLeagues">,
  filter?: ListLeaguesFilter,
): Promise<Result<LeagueResponse[]>> {
  const result = await deps.listLeagues(filter);
  return mapResult(result, (leagues) => leagues.map(mapToLeagueResponse));
}

export async function getLeague(
  deps: Pick<LeagueServiceDeps, "getLeagueById">,
  id: string,
): Promise<Result<LeagueResponse | null>> {
  const result = await deps.getLeagueById(id);
  return mapResult(result, (league) => (league === null ? null : mapToLeagueResponse(league)));
}
