import type { EntityResolutionDeps } from "@/src/crawler/entityResolutionDeps.ts";

/** All methods default to a `vi.fn()` returning `undefined` — override per test as needed. */
export function makeFakeEntityResolutionDeps(
  overrides: Partial<EntityResolutionDeps> = {},
): EntityResolutionDeps {
  return {
    findClubByLogoUrl: vi.fn(),
    findClubByName: vi.fn(),
    upsertClub: vi.fn(),
    upsertTeam: vi.fn(),
    upsertCompetition: vi.fn(),
    upsertSeason: vi.fn(),
    upsertLeague: vi.fn(),
    upsertFixture: vi.fn(),
    upsertTableEntry: vi.fn(),
    findExternalRef: vi.fn(),
    upsertExternalRef: vi.fn(),
    ...overrides,
  };
}
