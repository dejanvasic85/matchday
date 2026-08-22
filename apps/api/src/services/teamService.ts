// Team service (0045): maps DB rows to the wire shape. A nullable club link (unbridged
// fixture-discovered team) is exposed as a `type: "club" | "unaffiliated"` union, null-check-free.

import { mapResult, requireFound, type Result } from "@matchday/domain";
import {
  getTeamById,
  listTeams,
  listTeamsByLeagueId,
  type Db,
  type TeamWithClub,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type TeamServiceDeps = {
  listTeams: WithoutDb<typeof listTeams>;
  getTeamById: WithoutDb<typeof getTeamById>;
  listTeamsByLeagueId: WithoutDb<typeof listTeamsByLeagueId>;
};

/** Wires the real data-access functions to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createTeamServiceDeps(db: Db): TeamServiceDeps {
  return {
    listTeams: (clubId) => listTeams(db, clubId),
    getTeamById: (id) => getTeamById(db, id),
    listTeamsByLeagueId: (leagueId) => listTeamsByLeagueId(db, leagueId),
  };
}

export type ClubSummaryResponse = {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
};

type BaseTeamResponse = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type TeamResponse =
  | (BaseTeamResponse & { type: "club"; club: ClubSummaryResponse })
  | (BaseTeamResponse & { type: "unaffiliated" });

function mapToTeamResponse(team: TeamWithClub): TeamResponse {
  const base: BaseTeamResponse = {
    id: team.id,
    name: team.name,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };

  if (team.club === null) {
    return { ...base, type: "unaffiliated" };
  }

  return {
    ...base,
    type: "club",
    club: {
      id: team.club.id,
      name: team.club.name,
      displayName: team.club.displayName,
      logoUrl: team.club.logoUrl,
    },
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
): Promise<Result<TeamResponse>> {
  const result = await deps.getTeamById(id);
  return requireFound(result, mapToTeamResponse, "Team not found");
}

/** A league's teams, via `league_team` (#141/#145) — works for table-less leagues (e.g. MiniRoos)
 * too, unlike deriving membership from `table_entry`. */
export async function listLeagueTeams(
  deps: Pick<TeamServiceDeps, "listTeamsByLeagueId">,
  leagueId: string,
): Promise<Result<TeamResponse[]>> {
  const result = await deps.listTeamsByLeagueId(leagueId);
  return mapResult(result, (teams) => teams.map(mapToTeamResponse));
}
