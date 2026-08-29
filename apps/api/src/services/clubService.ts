// Club service: maps DB rows to the wire shape. Catalog data, open to any authenticated
// client, no subscription scoping.

import { requireFound, type Club, type Result } from "@matchday/domain";
import { mapPage, type PagedResponse } from "#services/pagedResponse.ts";
import { getClubById, listClubs, type Db, type PageRequest } from "@matchday/db";

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

/** `Pick`, not `Omit`, so a new column stays off the wire until named here — and mapped
 * field-by-field below, since a spread would leak it regardless. */
export type ClubResponse = Pick<
  Club,
  | "id"
  | "name"
  | "displayName"
  | "logoUrl"
  | "email"
  | "website"
  | "address"
  | "socials"
  | "grounds"
  | "color"
  | "accent"
  | "store"
> & {
  createdAt: string;
  updatedAt: string;
};

function mapToClubResponse(club: Club): ClubResponse {
  return {
    id: club.id,
    name: club.name,
    displayName: club.displayName,
    logoUrl: club.logoUrl,
    email: club.email,
    website: club.website,
    address: club.address,
    socials: club.socials,
    grounds: club.grounds,
    color: club.color,
    accent: club.accent,
    store: club.store,
    createdAt: club.createdAt.toISOString(),
    updatedAt: club.updatedAt.toISOString(),
  };
}

export async function listAllClubs(
  deps: Pick<ClubServiceDeps, "listClubs">,
  page?: PageRequest,
): Promise<Result<PagedResponse<ClubResponse>>> {
  return mapPage(await deps.listClubs(page), mapToClubResponse);
}

export async function getClub(
  deps: Pick<ClubServiceDeps, "getClubById">,
  id: string,
): Promise<Result<ClubResponse>> {
  const result = await deps.getClubById(id);
  return requireFound(result, mapToClubResponse, "Club not found");
}
