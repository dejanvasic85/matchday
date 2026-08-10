import type { EntityResolutionDeps } from "@/crawlers/dribl/entityResolutionDeps.ts";

/** All methods default to a `vi.fn()` returning `undefined` — override per test as needed. */
export function makeFakeEntityResolutionDeps(
  overrides: Partial<EntityResolutionDeps> = {},
): EntityResolutionDeps {
  return {
    findClubByLogoUrl: vi.fn(),
    findClubByName: vi.fn(),
    getClubById: vi.fn(),
    upsertClub: vi.fn(),
    updateClubEnrichmentFields: vi.fn(),
    upsertTeam: vi.fn(),
    upsertCompetition: vi.fn(),
    upsertSeason: vi.fn(),
    upsertLeague: vi.fn(),
    upsertFixture: vi.fn(),
    upsertTableEntry: vi.fn(),
    findExternalRef: vi.fn(),
    findExternalRefByInternalId: vi.fn(),
    upsertExternalRef: vi.fn(),
    getLeagueById: vi.fn(),
    ...overrides,
  };
}
