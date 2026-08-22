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

export { getClubLeagues, getLeagueOverview, getLeagueTeams } from "#leagueTasks.ts";
