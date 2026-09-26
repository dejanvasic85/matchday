// Drizzle schema, migrations, and data access for matchday's Postgres (Neon).
// Data-access functions return `Result` from @matchday/domain; no business rules here.

export * as schema from "#schema.ts";
export { type Ground, type Socials } from "#schema.ts";
export { createDbClient, type Db } from "#client.ts";
export { getDbConfig, type DbConfig } from "#config.ts";
export {
  fixtureStatusValue,
  sourceValue,
  externalRefEntityTypeValue,
  type FixtureStatus,
  type Source,
  type ExternalRefEntityType,
} from "#constants.ts";
export {
  listClubs,
  getClubById,
  findClubByLogoUrl,
  findClubByExternalRefSourceUrl,
  findClubByName,
  findClubsByName,
  upsertClub,
  updateClubEnrichmentFields,
  type ClubEnrichmentFields,
  type ListClubsFilter,
} from "#clubDb.ts";
export {
  listTeams,
  getTeamById,
  listTeamsByLeagueId,
  upsertTeam,
  type TeamWithClub,
} from "#teamDb.ts";
export {
  listCompetitions,
  getCompetitionById,
  findCompetitionsForSeasonByName,
  upsertCompetition,
} from "#competitionDb.ts";
export {
  listSeasons,
  getSeasonById,
  findLatestSeason,
  findSeasonByName,
  upsertSeason,
  type ListSeasonsFilter,
} from "#seasonDb.ts";
export {
  ensureCompetitionSeason,
  updateCompetitionSeasonDates,
  listSeasonWindows,
  getCompetitionSeason,
  type CompetitionSeasonInsert,
  type CompetitionSeasonDatesInput,
  type CompetitionSeasonWindow,
} from "#competitionSeasonDb.ts";
export {
  listLeagues,
  upsertLeague,
  getLeagueById,
  listLeaguesByClubId,
  type LeagueWithRefs,
  type ListLeaguesFilter,
} from "#leagueDb.ts";
export { upsertFixture, listFixturesByLeagueId } from "#fixtureDb.ts";
export {
  upsertTableEntry,
  listTableEntriesByLeagueId,
  listTableEntryTeamPairs,
  type TableEntryTeamPair,
} from "#tableEntryDb.ts";
export { upsertLeagueTeam, listClubIdsByLeagueId } from "#leagueTeamDb.ts";
export { upsertExternalRef, findExternalRef, findExternalRefByInternalId } from "#externalRefDb.ts";
export {
  upsertSubscription,
  listSubscribedLeagueIds,
  listSubscriptionsWithLeague,
  deleteSubscription,
  type SubscriptionWithLeague,
  type ListSubscriptionsFilter,
} from "#subscriptionDb.ts";
export { upsertClientByName, listClients, findClientByName } from "#clientDb.ts";
export {
  upsertClientClub,
  listClientClubs,
  listClientClubsByClientId,
  deleteClientClub,
  setClientClubWebhook,
  clearClientClubWebhook,
  listClientClubWebhooksForClubIds,
  type ClientClubWithClub,
  type ClientClubWebhook,
} from "#clientClubDb.ts";
export {
  insertApiToken,
  findApiTokenByHash,
  listApiTokens,
  listApiTokensByClientId,
  revokeApiToken,
  touchApiTokenLastUsed,
  type ApiTokenSummary,
} from "#apiTokenDb.ts";
export { pingDb } from "#healthDb.ts";
export {
  encodeCursor,
  decodeCursor,
  pagingLimitValue,
  resolveLimit,
  type Page,
  type PageRequest,
} from "#paging.ts";
