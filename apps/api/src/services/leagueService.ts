// League service (0045): maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping (ADR 0013).

import { mapResult, requireFound, type League, type Result } from "@matchday/domain";
import { getLeagueById, listLeagues, type Db, type ListLeaguesFilter } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type LeagueServiceDeps = {
  listLeagues: WithoutDb<typeof listLeagues>;
  getLeagueById: WithoutDb<typeof getLeagueById>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createLeagueServiceDeps(db: Db): LeagueServiceDeps {
  return {
    listLeagues: (filter) => listLeagues(db, filter),
    getLeagueById: (id) => getLeagueById(db, id),
  };
}

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
): Promise<Result<LeagueResponse>> {
  const result = await deps.getLeagueById(id);
  return requireFound(result, mapToLeagueResponse, "League not found");
}
