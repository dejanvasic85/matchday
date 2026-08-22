// Table entry service (0045): maps DB rows to the wire shape. Catalog data, open to any
// authenticated client — subscriptions only gate which leagues get deep-crawled (ADR 0012).

import { mapResult, type Result } from "@matchday/domain";
import { listTableEntriesByLeagueId, type Db, type schema } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type TableEntryServiceDeps = {
  listTableEntriesByLeagueId: WithoutDb<typeof listTableEntriesByLeagueId>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createTableEntryServiceDeps(db: Db): TableEntryServiceDeps {
  return {
    listTableEntriesByLeagueId: (leagueId) => listTableEntriesByLeagueId(db, leagueId),
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

export async function listLeagueTable(
  deps: TableEntryServiceDeps,
  leagueId: string,
): Promise<Result<TableEntryResponse[]>> {
  const result = await deps.listTableEntriesByLeagueId(leagueId);
  return mapResult(result, (entries) => entries.map(mapToTableEntryResponse));
}
