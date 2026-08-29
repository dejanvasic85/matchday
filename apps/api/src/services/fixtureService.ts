// Fixture service: maps DB rows to the wire shape. Catalog data, open to any authenticated
// client — subscriptions only gate which leagues get deep-crawled, not who can read.

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

/** `Pick`, not `Omit`, so a new column stays off the wire until named here — and mapped
 * field-by-field below, since a spread would leak it regardless. */
export type FixtureResponse = Pick<
  FixtureRow,
  | "id"
  | "leagueId"
  | "competitionId"
  | "seasonId"
  | "round"
  | "homeTeamId"
  | "awayTeamId"
  | "venue"
  | "status"
  | "homeScore"
  | "awayScore"
  | "isBye"
> & {
  latitude: number | null;
  longitude: number | null;
  kickoffAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapToFixtureResponse(row: FixtureRow): FixtureResponse {
  return {
    id: row.id,
    leagueId: row.leagueId,
    competitionId: row.competitionId,
    seasonId: row.seasonId,
    round: row.round,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    venue: row.venue,
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    isBye: row.isBye,
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
