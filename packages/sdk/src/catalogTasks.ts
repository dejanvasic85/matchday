// Whole-collection reads for the paged catalog routes: the cursor loop, done for you.
//
// Paging is still a guard rail, not the intended access path — reach for a filter
// (`getLeagueTeams`, `listAllTeams(client, { clubId })`) before walking a full catalog.

import type { MatchdayClient } from "#client.ts";
import type { components, paths } from "#generated/schema.d.ts";
import { fetchAllPages, type PagingInit } from "#paging.ts";
import type { Result } from "#result.ts";

type Club = components["schemas"]["Club"];
type Competition = components["schemas"]["Competition"];
type Season = components["schemas"]["Season"];
type Team = components["schemas"]["Team"];

/** Server-side filters for `GET /teams`, minus the paging params `PagingInit` already covers. */
export type TeamFilter = Pick<NonNullable<paths["/teams"]["get"]["parameters"]["query"]>, "clubId">;

/** Every club, ~1200 rows. */
export async function listAllClubs(
  client: MatchdayClient,
  init: PagingInit = {},
): Promise<Result<Club[]>> {
  return fetchAllPages<Club>(
    (query, signal) => client.GET("/clubs", { params: { query }, signal }),
    init,
  );
}

/** Every team, optionally scoped to one club. Unfiltered this is ~6500 rows and ~2.4 MB. */
export async function listAllTeams(
  client: MatchdayClient,
  filter: TeamFilter = {},
  init: PagingInit = {},
): Promise<Result<Team[]>> {
  return fetchAllPages<Team>(
    (query, signal) => client.GET("/teams", { params: { query: { ...filter, ...query } }, signal }),
    init,
  );
}

/** Every competition. */
export async function listAllCompetitions(
  client: MatchdayClient,
  init: PagingInit = {},
): Promise<Result<Competition[]>> {
  return fetchAllPages<Competition>(
    (query, signal) => client.GET("/competitions", { params: { query }, signal }),
    init,
  );
}

/** Every season. */
export async function listAllSeasons(
  client: MatchdayClient,
  init: PagingInit = {},
): Promise<Result<Season[]>> {
  return fetchAllPages<Season>(
    (query, signal) => client.GET("/seasons", { params: { query }, signal }),
    init,
  );
}
