// Drizzle schema, migrations, and data access for matchday's Postgres (Neon).
// Data-access functions return `Result` from @matchday/domain; no business rules here.

export * as schema from "./schema.ts";
export { type Ground, type Socials } from "./schema.ts";
export { createDbClient, type Db } from "./client.ts";
export { getDbConfig, type DbConfig } from "./config.ts";
export {
  fixtureStatusValue,
  sourceValue,
  externalRefEntityTypeValue,
  type FixtureStatus,
  type Source,
  type ExternalRefEntityType,
} from "./constants.ts";
export {
  listClubs,
  getClubById,
  findClubByLogoUrl,
  findClubByName,
  upsertClub,
  updateClubEnrichmentFields,
  type ClubEnrichmentFields,
} from "./clubDb.ts";
export { upsertTeam } from "./teamDb.ts";
export { upsertCompetition } from "./competitionDb.ts";
export { upsertSeason } from "./seasonDb.ts";
export { upsertLeague, getLeagueById } from "./leagueDb.ts";
export { upsertFixture } from "./fixtureDb.ts";
export { upsertTableEntry } from "./tableEntryDb.ts";
export {
  upsertExternalRef,
  findExternalRef,
  findExternalRefByInternalId,
} from "./externalRefDb.ts";
export { upsertSubscription, listSubscribedLeagueIds } from "./subscriptionDb.ts";
