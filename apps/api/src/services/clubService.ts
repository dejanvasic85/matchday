// Club service (0045): maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping (ADR 0013).

import { mapResult, requireFound, type Club, type Result } from "@matchday/domain";
import { getClubById, listClubs, type Db } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClubServiceDeps = {
  listClubs: WithoutDb<typeof listClubs>;
  getClubById: WithoutDb<typeof getClubById>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createClubServiceDeps(db: Db): ClubServiceDeps {
  return {
    listClubs: () => listClubs(db),
    getClubById: (id) => getClubById(db, id),
  };
}

export type ClubResponse = Omit<Club, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToClubResponse(club: Club): ClubResponse {
  return {
    ...club,
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
  };
}

export async function listAllClubs(
  deps: Pick<ClubServiceDeps, "listClubs">,
): Promise<Result<ClubResponse[]>> {
  const result = await deps.listClubs();
  return mapResult(result, (clubs) => clubs.map(mapToClubResponse));
}

export async function getClub(
  deps: Pick<ClubServiceDeps, "getClubById">,
  id: string,
): Promise<Result<ClubResponse>> {
  const result = await deps.getClubById(id);
  return requireFound(result, mapToClubResponse, "Club not found");
}
