// Fixture service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to
// the wire shape (timestamps as ISO strings, numeric lat/long as numbers) and lists a league's
// fixtures. Catalog data — open to any authenticated client, no subscription scoping. Subscriptions
// only drive *which* leagues get deep-crawled (ADR 0012); once a league's fixtures exist, any
// client can read them, same as clubs/leagues/etc (contrast an earlier draft of this file, which
// wrongly gated reads on the requester's own subscription).

import { mapResult, type Result } from "@matchday/domain";
import { listFixturesByLeagueId, type Db, type schema } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type FixtureServiceDeps = {
  listFixturesByLeagueId: WithoutDb<typeof listFixturesByLeagueId>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createFixtureServiceDeps(db: Db): FixtureServiceDeps {
  return {
    listFixturesByLeagueId: (leagueId) => listFixturesByLeagueId(db, leagueId),
  };
}

type FixtureRow = typeof schema.fixture.$inferSelect;

export type FixtureResponse = Omit<
  FixtureRow,
  "latitude" | "longitude" | "kickoffAt" | "createdAt" | "updatedAt"
> & {
  latitude: number | null;
  longitude: number | null;
  kickoffAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapToFixtureResponse(row: FixtureRow): FixtureResponse {
  return {
    ...row,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    kickoffAt: row.kickoffAt === null ? null : row.kickoffAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLeagueFixtures(
  deps: FixtureServiceDeps,
  leagueId: string,
): Promise<Result<FixtureResponse[]>> {
  const result = await deps.listFixturesByLeagueId(leagueId);
  return mapResult(result, (fixtures) => fixtures.map(mapToFixtureResponse));
}
