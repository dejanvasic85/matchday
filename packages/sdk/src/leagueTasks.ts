// Task-shaped helpers: thin wrappers that encode *what to ask for*, so a consumer doesn't rebuild
// a full-catalog fetch-and-join to get data one league-scoped call already returns.

import type { components, paths } from "#generated/schema.d.ts";
import type { MatchdayClient, MatchdayRequestInit } from "#client.ts";
import { fetchAllPages, type PagingInit } from "#paging.ts";
import { unwrap, type Result } from "#result.ts";

/** Server-side filters for `GET /leagues`, minus the paging params `PagingInit` already covers. */
export type LeagueFilter = Pick<
  NonNullable<paths["/leagues"]["get"]["parameters"]["query"]>,
  "competitionId" | "seasonId" | "clubId"
>;

type League = components["schemas"]["League"];
type LeagueOverview = components["schemas"]["LeagueOverview"];
type Team = components["schemas"]["Team"];

/** Everything one league page renders, in a single request — league, fixtures, table and teams.
 * `init` is spread before `params`/`headers`/`body`, so a caller can pass any standard or
 * consumer-augmented `RequestInit` field (a `signal`, or Next.js's `next` cache-tag config) without
 * being able to override the path, the client's `Authorization` header, or send a body — `init`'s
 * type already excludes those, but pinning them here also closes it off for a caller who
 * sidesteps the type (a widened variable rather than an object literal). */
export async function getLeagueOverview(
  client: MatchdayClient,
  leagueId: string,
  init?: MatchdayRequestInit,
): Promise<Result<LeagueOverview>> {
  return unwrap(
    await client.GET("/leagues/{id}/overview", {
      ...init,
      params: { path: { id: leagueId } },
      headers: undefined,
      body: undefined,
    }),
  );
}

/** A league's teams, each with its club embedded. Prefer this over `GET /teams` + `GET /clubs`:
 * the full catalog is ~6500 teams and 2.4 MB to resolve the handful in one league. */
export async function getLeagueTeams(
  client: MatchdayClient,
  leagueId: string,
  init?: MatchdayRequestInit,
): Promise<Result<Team[]>> {
  return unwrap(
    await client.GET("/leagues/{id}/teams", {
      ...init,
      params: { path: { id: leagueId } },
      headers: undefined,
      body: undefined,
    }),
  );
}

/**
 * Every league matching the filter, optionally scoped by competition, season and/or club. Follows
 * `nextCursor` to the end, so "every" stays true rather than silently meaning "the first page".
 */
export async function listAllLeagues(
  client: MatchdayClient,
  filter: LeagueFilter = {},
  init: PagingInit = {},
): Promise<Result<League[]>> {
  return fetchAllPages<League>(
    (query, signal) =>
      client.GET("/leagues", { params: { query: { ...filter, ...query } }, signal }),
    init,
  );
}

/** Every league a club's teams play in, including divisions that never publish a ladder. */
export async function getClubLeagues(
  client: MatchdayClient,
  clubId: string,
  init?: PagingInit,
): Promise<Result<League[]>> {
  return listAllLeagues(client, { clubId }, init);
}
