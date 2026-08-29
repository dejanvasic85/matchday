// Season service: maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping.

import { requireFound, type Result, type Season } from "@matchday/domain";
import { mapPage, type PagedResponse } from "#services/pagedResponse.ts";
import { getSeasonById, listSeasons, type Db, type PageRequest } from "@matchday/db";

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

/** `Pick`, not `Omit`, so a new column stays off the wire until named here — and mapped
 * field-by-field below, since a spread would leak it regardless. */
export type SeasonResponse = Pick<Season, "id" | "name"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToSeasonResponse(season: Season): SeasonResponse {
  return {
    id: season.id,
    name: season.name,
    createdAt: season.createdAt.toISOString(),
    updatedAt: season.updatedAt.toISOString(),
  };
}

export async function listAllSeasons(
  deps: Pick<SeasonServiceDeps, "listSeasons">,
  page?: PageRequest,
): Promise<Result<PagedResponse<SeasonResponse>>> {
  return mapPage(await deps.listSeasons(page), mapToSeasonResponse);
}

export async function getSeason(
  deps: Pick<SeasonServiceDeps, "getSeasonById">,
  id: string,
): Promise<Result<SeasonResponse>> {
  const result = await deps.getSeasonById(id);
  return requireFound(result, mapToSeasonResponse, "Season not found");
}
