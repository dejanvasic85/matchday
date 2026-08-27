export type { components, paths } from "#generated/schema.d.ts";

export {
  clientDefaultValue,
  createMatchdayClient,
  type MatchdayClient,
  type MatchdayClientOptions,
} from "#client.ts";

export {
  ok,
  err,
  unwrap,
  unwrapOrThrow,
  type FetchOutcome,
  type MatchdayApiError,
  type Result,
} from "#result.ts";

export {
  fetchAllPages,
  pagingDefaultValue,
  type Page,
  type PageFetcher,
  type PageQuery,
  type PagingInit,
} from "#paging.ts";

export {
  listAllClubs,
  listAllCompetitions,
  listAllSeasons,
  listAllTeams,
  type TeamFilter,
} from "#catalogTasks.ts";

export {
  getClubLeagues,
  getLeagueOverview,
  getLeagueTeams,
  listAllLeagues,
  type LeagueFilter,
} from "#leagueTasks.ts";
