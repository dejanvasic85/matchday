// Table entry service (0045): thin business logic over data access (AGENTS.md) — maps the DB row
// to the wire shape (timestamps as ISO strings) and lists a league's table. Subscription-scoped
// (ADR 0012): only a client with an active subscription to the league sees its table (contrast
// leagueService's open catalog data).

import { forbidden, mapResult, type ClientId, type Result } from "@matchday/domain";
import {
  hasActiveSubscription,
  listTableEntriesByLeagueId,
  type Db,
  type schema,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type TableEntryServiceDeps = {
  listTableEntriesByLeagueId: WithoutDb<typeof listTableEntriesByLeagueId>;
  hasActiveSubscription: WithoutDb<typeof hasActiveSubscription>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createTableEntryServiceDeps(db: Db): TableEntryServiceDeps {
  return {
    listTableEntriesByLeagueId: (leagueId) => listTableEntriesByLeagueId(db, leagueId),
    hasActiveSubscription: (clientId, leagueId) => hasActiveSubscription(db, clientId, leagueId),
  };
}

type TableEntryRow = typeof schema.tableEntry.$inferSelect;

export type TableEntryResponse = Omit<TableEntryRow, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToTableEntryResponse(row: TableEntryRow): TableEntryResponse {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * A league's table, position-ordered, gated on `clientId` holding an *active* subscription to
 * `leagueId` (ADR 0012) — a `Forbidden` failure otherwise. A nonexistent league id also comes
 * back `Forbidden` rather than `NotFound`, for the same reason as `listLeagueFixtures`: nothing
 * can be actively subscribed to a league that doesn't exist.
 */
export async function listLeagueTable(
  deps: TableEntryServiceDeps,
  clientId: ClientId,
  leagueId: string,
): Promise<Result<TableEntryResponse[]>> {
  const subscribed = await deps.hasActiveSubscription(clientId, leagueId);
  if (!subscribed.ok) {
    return subscribed;
  }
  if (!subscribed.value) {
    return forbidden("No active subscription to this league");
  }

  const result = await deps.listTableEntriesByLeagueId(leagueId);
  return mapResult(result, (entries) => entries.map(mapToTableEntryResponse));
}
