// Season service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to
// the wire shape (timestamps as ISO strings) and lists/fetches seasons. Catalog data — open to
// any authenticated client, no subscription scoping (ADR 0013).

import { mapResult, type Result, type Season } from "@matchday/domain";
import type { getSeasonById, listSeasons } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonServiceDeps = {
  listSeasons: WithoutDb<typeof listSeasons>;
  getSeasonById: WithoutDb<typeof getSeasonById>;
};

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
): Promise<Result<SeasonResponse | null>> {
  const result = await deps.getSeasonById(id);
  return mapResult(result, (season) => (season === null ? null : mapToSeasonResponse(season)));
}
