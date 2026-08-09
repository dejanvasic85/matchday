// Club service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to the
// wire shape (timestamps as ISO strings) and lists/fetches clubs. Catalog data — open to any
// authenticated client, no subscription scoping (ADR 0013).

import { mapResult, type Club, type Result } from "@matchday/domain";
import type { getClubById, listClubs } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClubServiceDeps = {
  listClubs: WithoutDb<typeof listClubs>;
  getClubById: WithoutDb<typeof getClubById>;
};

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
): Promise<Result<ClubResponse | null>> {
  const result = await deps.getClubById(id);
  return mapResult(result, (club) => (club === null ? null : mapToClubResponse(club)));
}
