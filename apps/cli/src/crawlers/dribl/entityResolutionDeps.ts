// Shared collaborator shape for the entity-resolution services in this directory (resolveClub,
// resolveTeam, resolveFixtureEntities, resolveTableEntryEntities). Each entry is a @matchday/db
// query function with `db` already bound — the crawl job builds one `EntityResolutionDeps` per
// run and threads it through every resolver, so services depend on injectable functions rather
// than importing @matchday/db directly (AGENTS.md: DI over mocking the DB — tests pass vi.fn()
// fakes here instead of vi.mock("@matchday/db")).

import {
  findClubByExternalRefSourceUrl,
  findClubByLogoUrl,
  findClubByName,
  findExternalRef,
  findExternalRefByInternalId,
  getClubById,
  getLeagueById,
  getTeamById,
  updateClubEnrichmentFields,
  upsertClub,
  upsertCompetition,
  upsertExternalRef,
  upsertFixture,
  upsertLeague,
  upsertSeason,
  upsertTableEntry,
  upsertTeam,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type EntityResolutionDeps = {
  findClubByLogoUrl: WithoutDb<typeof findClubByLogoUrl>;
  findClubByExternalRefSourceUrl: WithoutDb<typeof findClubByExternalRefSourceUrl>;
  findClubByName: WithoutDb<typeof findClubByName>;
  getClubById: WithoutDb<typeof getClubById>;
  upsertClub: WithoutDb<typeof upsertClub>;
  updateClubEnrichmentFields: WithoutDb<typeof updateClubEnrichmentFields>;
  getTeamById: WithoutDb<typeof getTeamById>;
  upsertTeam: WithoutDb<typeof upsertTeam>;
  upsertCompetition: WithoutDb<typeof upsertCompetition>;
  upsertSeason: WithoutDb<typeof upsertSeason>;
  upsertLeague: WithoutDb<typeof upsertLeague>;
  upsertFixture: WithoutDb<typeof upsertFixture>;
  upsertTableEntry: WithoutDb<typeof upsertTableEntry>;
  findExternalRef: WithoutDb<typeof findExternalRef>;
  findExternalRefByInternalId: WithoutDb<typeof findExternalRefByInternalId>;
  upsertExternalRef: WithoutDb<typeof upsertExternalRef>;
  getLeagueById: WithoutDb<typeof getLeagueById>;
};

/** Binds `db` into every @matchday/db query function this module's resolvers need. */
export function createEntityResolutionDeps(
  db: Parameters<typeof findClubByLogoUrl>[0],
): EntityResolutionDeps {
  return {
    findClubByLogoUrl: (logoUrl) => findClubByLogoUrl(db, logoUrl),
    findClubByExternalRefSourceUrl: (sourceUrl) => findClubByExternalRefSourceUrl(db, sourceUrl),
    findClubByName: (name) => findClubByName(db, name),
    getClubById: (id) => getClubById(db, id),
    upsertClub: (values) => upsertClub(db, values),
    updateClubEnrichmentFields: (id, fields) => updateClubEnrichmentFields(db, id, fields),
    getTeamById: (id) => getTeamById(db, id),
    upsertTeam: (values) => upsertTeam(db, values),
    upsertCompetition: (values) => upsertCompetition(db, values),
    upsertSeason: (values) => upsertSeason(db, values),
    upsertLeague: (values) => upsertLeague(db, values),
    upsertFixture: (values) => upsertFixture(db, values),
    upsertTableEntry: (values) => upsertTableEntry(db, values),
    findExternalRef: (source, sourceId) => findExternalRef(db, source, sourceId),
    findExternalRefByInternalId: (entityType, internalId, source) =>
      findExternalRefByInternalId(db, entityType, internalId, source),
    upsertExternalRef: (values) => upsertExternalRef(db, values),
    getLeagueById: (id) => getLeagueById(db, id),
  };
}
