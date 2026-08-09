// Team service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to the
// wire shape (timestamps as ISO strings) and lists/fetches teams. Catalog data — open to any
// authenticated client, no subscription scoping (ADR 0013).

import { mapResult, type Result, type Team } from "@matchday/domain";
import type { getTeamById, listTeams } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type TeamServiceDeps = {
  listTeams: WithoutDb<typeof listTeams>;
  getTeamById: WithoutDb<typeof getTeamById>;
};

export type TeamResponse = Omit<Team, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function mapToTeamResponse(team: Team): TeamResponse {
  return {
    ...team,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

export async function listAllTeams(
  deps: Pick<TeamServiceDeps, "listTeams">,
  clubId?: string,
): Promise<Result<TeamResponse[]>> {
  const result = await deps.listTeams(clubId);
  return mapResult(result, (teams) => teams.map(mapToTeamResponse));
}

export async function getTeam(
  deps: Pick<TeamServiceDeps, "getTeamById">,
  id: string,
): Promise<Result<TeamResponse | null>> {
  const result = await deps.getTeamById(id);
  return mapResult(result, (team) => (team === null ? null : mapToTeamResponse(team)));
}
