// Shared collaborator shape for this directory's entity-resolution services, with `db` already
// bound — DI over mocking the DB, so tests pass vi.fn() fakes instead of vi.mock("@matchday/db").

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
  upsertLeagueTeam,
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
  upsertLeagueTeam: WithoutDb<typeof upsertLeagueTeam>;
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
    upsertLeagueTeam: (values) => upsertLeagueTeam(db, values),
    findExternalRef: (source, sourceId) => findExternalRef(db, source, sourceId),
    findExternalRefByInternalId: (entityType, internalId, source) =>
      findExternalRefByInternalId(db, entityType, internalId, source),
    upsertExternalRef: (values) => upsertExternalRef(db, values),
    getLeagueById: (id) => getLeagueById(db, id),
  };
}
