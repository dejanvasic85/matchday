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
  upsertTeam,
  upsertCompetition,
  upsertSeason,
  upsertLeague,
  upsertFixture,
  upsertTableEntry,
  upsertExternalRef,
  findExternalRef,
  findExternalRefByInternalId,
  getLeagueById,
  upsertSubscription,
  listSubscribedLeagueIds,
} from "./queries.ts";
