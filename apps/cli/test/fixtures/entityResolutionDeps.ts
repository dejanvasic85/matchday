import { ok } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

/** Most methods default to a `vi.fn()` returning `undefined` — override per test as needed. The
 * three club-bridge lookups default to `ok(null)` ("no match") since resolveTeamForFixture calls
 * them unconditionally on every existing-team sighting too, not just tests that care about it. */
export function makeFakeEntityResolutionDeps(
  overrides: Partial<EntityResolutionDeps> = {},
): EntityResolutionDeps {
  return {
    findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
    findClubByName: vi.fn().mockResolvedValue(ok(null)),
    getClubById: vi.fn(),
    upsertClub: vi.fn(),
    updateClubEnrichmentFields: vi.fn(),
    getTeamById: vi.fn().mockResolvedValue(ok(null)),
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
