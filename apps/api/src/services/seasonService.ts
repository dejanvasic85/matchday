// Season service (0045): maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping (ADR 0013).

import { mapResult, requireFound, type Result, type Season } from "@matchday/domain";
import { getSeasonById, listSeasons, type Db } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonServiceDeps = {
  listSeasons: WithoutDb<typeof listSeasons>;
  getSeasonById: WithoutDb<typeof getSeasonById>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createSeasonServiceDeps(db: Db): SeasonServiceDeps {
  return {
    listSeasons: () => listSeasons(db),
    getSeasonById: (id) => getSeasonById(db, id),
  };
}

export type SeasonResponse = Omit<Season, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToSeasonResponse(season: Season): SeasonResponse {
  return {
    ...season,
    createdAt: season.createdAt.toISOString(),
    updatedAt: season.updatedAt.toISOString(),
  };
}

export async function listAllSeasons(
  deps: Pick<SeasonServiceDeps, "listSeasons">,
): Promise<Result<SeasonResponse[]>> {
  const result = await deps.listSeasons();
  return mapResult(result, (seasons) => seasons.map(mapToSeasonResponse));
}

export async function getSeason(
  deps: Pick<SeasonServiceDeps, "getSeasonById">,
  id: string,
): Promise<Result<SeasonResponse>> {
  const result = await deps.getSeasonById(id);
  return requireFound(result, mapToSeasonResponse, "Season not found");
}
