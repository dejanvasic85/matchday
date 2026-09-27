import { ok, type ExternalRef } from "@matchday/domain";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

export function makeCoastalExternalRefRow(sourceId: string): ExternalRef {
  return {
    id: "ext_row0000001",
    entityType: "league",
    internalId: "lea_new00000001",
    source: "coastal",
    sourceId,
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

/** Every external_ref lookup misses and every upsert succeeds — a first coastal crawl. */
export function makeCoastalHappyPathDeps(
  overrides: Partial<EntityResolutionDeps> = {},
): EntityResolutionDeps {
  return makeFakeEntityResolutionDeps({
    findExternalRef: vi.fn().mockResolvedValue(ok(null)),
    upsertExternalRef: vi.fn().mockResolvedValue(ok(makeCoastalExternalRefRow("coastal"))),
    upsertCompetition: vi.fn().mockResolvedValue(ok({ id: "cmp_new00000001" })),
    upsertSeason: vi.fn().mockResolvedValue(ok({ id: "sea_new00000001" })),
    upsertLeague: vi.fn().mockResolvedValue(ok({ id: "lea_new00000001" })),
    upsertClub: vi.fn().mockResolvedValue(ok({ id: "clb_new00000001" })),
    upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_new00000001" })),
    upsertLeagueTeam: vi.fn().mockResolvedValue(ok({ id: "lgt_new00000001" })),
    upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
    upsertTableEntry: vi.fn().mockResolvedValue(ok({ id: "tab_new00000001" })),
    ...overrides,
  });
}
