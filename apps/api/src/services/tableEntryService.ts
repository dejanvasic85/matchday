// Table entry service: maps DB rows to the wire shape. Catalog data, open to any
// authenticated client — subscriptions only gate which leagues get crawled.

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

/** `Pick`, not `Omit`, so a new column stays off the wire until named here — and mapped
 * field-by-field below, since a spread would leak it regardless. */
export type TableEntryResponse = Pick<
  TableEntryRow,
  | "id"
  | "leagueId"
  | "competitionId"
  | "seasonId"
  | "teamId"
  | "position"
  | "played"
  | "won"
  | "drawn"
  | "lost"
  | "goalsFor"
  | "goalsAgainst"
  | "goalDifference"
  | "points"
> & {
  createdAt: string;
  updatedAt: string;
};

function mapToTableEntryResponse(row: TableEntryRow): TableEntryResponse {
  return {
    id: row.id,
    leagueId: row.leagueId,
    competitionId: row.competitionId,
    seasonId: row.seasonId,
    teamId: row.teamId,
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
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
