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
} from "#clubDb.ts";
export { listTeams, getTeamById, upsertTeam } from "#teamDb.ts";
export { listCompetitions, getCompetitionById, upsertCompetition } from "#competitionDb.ts";
export { listSeasons, getSeasonById, upsertSeason } from "#seasonDb.ts";
export {
  listLeagues,
  upsertLeague,
  getLeagueById,
  listLeaguesByClubId,
  type ListLeaguesFilter,
} from "#leagueDb.ts";
export { upsertFixture, listFixturesByLeagueId } from "#fixtureDb.ts";
export { upsertTableEntry, listTableEntriesByLeagueId } from "#tableEntryDb.ts";
export { upsertExternalRef, findExternalRef, findExternalRefByInternalId } from "#externalRefDb.ts";
export {
  upsertSubscription,
  listSubscribedLeagueIds,
  listSubscriptionsWithLeague,
  deleteSubscription,
  setSubscriptionWebhook,
  clearSubscriptionWebhook,
  listActiveSubscriptionsForLeagueWithWebhook,
  type SubscriptionWithLeague,
  type SubscriptionWebhook,
} from "#subscriptionDb.ts";
export { upsertClientByName, listClients, findClientByName } from "#clientDb.ts";
export {
  insertApiToken,
  findApiTokenByHash,
  listApiTokens,
  listApiTokensByClientId,
  revokeApiToken,
} from "#apiTokenDb.ts";
export { pingDb } from "#healthDb.ts";
