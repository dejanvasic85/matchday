// League service: maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping.

import { requireFound, type Result } from "@matchday/domain";
import { mapPage, type PagedResponse } from "#services/pagedResponse.ts";
import {
  getLeagueById,
  listLeagues,
  type Db,
  type LeagueWithRefs,
  type ListLeaguesFilter,
  type PageRequest,
} from "@matchday/db";

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
    listLeagues: (filter, page) => listLeagues(db, filter, page),
    getLeagueById: (id) => getLeagueById(db, id),
  };
}

/** Lean embed of a league's competition/season — both tables are `{ id, name }` plus timestamps,
 * and the timestamps are ingest bookkeeping no consumer labels a league with. */
export type LeagueRefSummaryResponse = { id: string; name: string };

/** `Pick`, not `Omit`, so a new `league` column stays off the wire until it's added here
 * deliberately — and mapped field-by-field below, since a spread would leak it regardless.
 * `hasTable` is nullable in the DB (leagues written before the column existed) but never on the
 * wire — null reads as false below, so a consumer only ever sees true/false. */
export type LeagueResponse = Pick<LeagueWithRefs, "id" | "name" | "competitionId" | "seasonId"> & {
  hasTable: boolean;
  competition: LeagueRefSummaryResponse;
  season: LeagueRefSummaryResponse;
  createdAt: string;
  updatedAt: string;
};

function mapToLeagueResponse(league: LeagueWithRefs): LeagueResponse {
  return {
    id: league.id,
    name: league.name,
    competitionId: league.competitionId,
    seasonId: league.seasonId,
    hasTable: league.hasTable ?? false,
    competition: { id: league.competition.id, name: league.competition.name },
    season: { id: league.season.id, name: league.season.name },
    createdAt: league.createdAt.toISOString(),
    updatedAt: league.updatedAt.toISOString(),
  };
}

export async function listAllLeagues(
  deps: Pick<LeagueServiceDeps, "listLeagues">,
  filter?: ListLeaguesFilter,
  page?: PageRequest,
): Promise<Result<PagedResponse<LeagueResponse>>> {
  return mapPage(await deps.listLeagues(filter, page), mapToLeagueResponse);
}

export async function getLeague(
  deps: Pick<LeagueServiceDeps, "getLeagueById">,
  id: string,
): Promise<Result<LeagueResponse>> {
  const result = await deps.getLeagueById(id);
  return requireFound(result, mapToLeagueResponse, "League not found");
}
