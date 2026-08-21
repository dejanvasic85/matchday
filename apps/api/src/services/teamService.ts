// Team service (0045): thin business logic over data access (AGENTS.md) — maps the DB row to the
// wire shape (timestamps as ISO strings, owning club trimmed to a lean summary — #145) and
// lists/fetches teams. Catalog data — open to any authenticated client, no subscription scoping
// (ADR 0013).

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

export type TeamResponse = Omit<TeamWithClub, "createdAt" | "updatedAt" | "club"> & {
  createdAt: string;
  updatedAt: string;
  club: ClubSummaryResponse | null;
};

function mapToTeamResponse(team: TeamWithClub): TeamResponse {
  return {
    id: team.id,
    clubId: team.clubId,
    name: team.name,
    club:
      team.club === null
        ? null
        : {
            id: team.club.id,
            name: team.club.name,
            displayName: team.club.displayName,
            logoUrl: team.club.logoUrl,
          },
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
