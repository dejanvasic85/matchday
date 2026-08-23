// Task-shaped helpers: thin wrappers that encode *what to ask for*, so a consumer doesn't rebuild
// a full-catalog fetch-and-join to get data one league-scoped call already returns.

import type { components } from "#generated/schema.d.ts";
import type { MatchdayClient } from "#client.ts";
import { unwrap, type Result } from "#result.ts";

type League = components["schemas"]["League"];
type LeagueOverview = components["schemas"]["LeagueOverview"];
type Team = components["schemas"]["Team"];

/** Everything one league page renders, in a single request — league, fixtures, table and teams. */
export async function getLeagueOverview(
  client: MatchdayClient,
  leagueId: string,
  init?: { signal?: AbortSignal },
): Promise<Result<LeagueOverview>> {
  return unwrap(
    await client.GET("/leagues/{id}/overview", {
      params: { path: { id: leagueId } },
      signal: init?.signal,
    }),
  );
}

/** A league's teams, each with its club embedded. Prefer this over `GET /teams` + `GET /clubs`:
 * the full catalog is ~6500 teams and 2.4 MB to resolve the handful in one league. */
export async function getLeagueTeams(
  client: MatchdayClient,
  leagueId: string,
  init?: { signal?: AbortSignal },
): Promise<Result<Team[]>> {
  return unwrap(
    await client.GET("/leagues/{id}/teams", {
      params: { path: { id: leagueId } },
      signal: init?.signal,
    }),
  );
}

/** Every league a club's teams play in, including divisions that never publish a ladder. */
export async function getClubLeagues(
  client: MatchdayClient,
  clubId: string,
  init?: { signal?: AbortSignal },
): Promise<Result<League[]>> {
  return unwrap(
    await client.GET("/leagues", { params: { query: { clubId } }, signal: init?.signal }),
  );
}
