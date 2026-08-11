// Fixture service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to
// the wire shape (timestamps as ISO strings, numeric lat/long as numbers) and lists a league's
// fixtures. Subscription-scoped (ADR 0012): only a client with an active subscription to the
// league sees its fixtures, so this is the one catalog-adjacent resource that isn't open to every
// authenticated client (contrast leagueService).

import { forbidden, mapResult, type ClientId, type Result } from "@matchday/domain";
import { hasActiveSubscription, listFixturesByLeagueId, type Db, type schema } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type FixtureServiceDeps = {
  listFixturesByLeagueId: WithoutDb<typeof listFixturesByLeagueId>;
  hasActiveSubscription: WithoutDb<typeof hasActiveSubscription>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createFixtureServiceDeps(db: Db): FixtureServiceDeps {
  return {
    listFixturesByLeagueId: (leagueId) => listFixturesByLeagueId(db, leagueId),
    hasActiveSubscription: (clientId, leagueId) => hasActiveSubscription(db, clientId, leagueId),
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

/**
 * A league's fixtures, gated on `clientId` holding an *active* subscription to `leagueId`
 * (ADR 0012) — a `Forbidden` failure otherwise. A nonexistent league id also comes back
 * `Forbidden` rather than `NotFound`: nothing can be actively subscribed to a league that doesn't
 * exist, so the two cases are indistinguishable from the caller's side and there's no separate
 * existence check to run.
 */
export async function listLeagueFixtures(
  deps: FixtureServiceDeps,
  clientId: ClientId,
  leagueId: string,
): Promise<Result<FixtureResponse[]>> {
  const subscribed = await deps.hasActiveSubscription(clientId, leagueId);
  if (!subscribed.ok) {
    return subscribed;
  }
  if (!subscribed.value) {
    return forbidden("No active subscription to this league");
  }

  const result = await deps.listFixturesByLeagueId(leagueId);
  return mapResult(result, (fixtures) => fixtures.map(mapToFixtureResponse));
}
