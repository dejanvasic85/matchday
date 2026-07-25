import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { resolveDriblLeagueIds } from "./resolveDriblLeagueIds.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeLeagueRow(overrides: Partial<{ competitionId: string; seasonId: string }> = {}) {
  return {
    id: "lea_abc123",
    name: "NPL VIC Men",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeExternalRefRow(sourceId: string) {
  return {
    id: "ext_row0000001",
    entityType: "league" as const,
    internalId: "lea_abc123",
    source: "dribl" as const,
    sourceId,
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

const leagueId = "lea_abc123" as const;

describe("resolveDriblLeagueIds", () => {
  it("resolves league/competition/season hashes and the entity context", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockImplementation((entityType: string, internalId: string) =>
          Promise.resolve(ok(makeExternalRefRow(`${entityType}-hash-${internalId}`))),
        ),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(result.ok);
    expect(result.value).toEqual({
      hashes: {
        league: "league-hash-lea_abc123",
        competition: "competition-hash-cmp_abc123",
        season: "season-hash-sea_abc123",
      },
      context: { competitionId: "cmp_abc123", seasonId: "sea_abc123", leagueId: "lea_abc123" },
    });
  });

  it("returns err when the league doesn't exist", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("returns err when the league's competitionId has an unexpected prefix", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi
        .fn()
        .mockResolvedValue(ok(makeLeagueRow({ competitionId: "lea_wrong_prefix" }))),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("returns err when the league's seasonId has an unexpected prefix", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow({ seasonId: "lea_wrong_prefix" }))),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("returns err when the league's dribl hash is missing", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("returns err when the competition's dribl hash is missing", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockImplementation((entityType: string) =>
          Promise.resolve(ok(entityType === "league" ? makeExternalRefRow("league-hash") : null)),
        ),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("propagates a getLeagueById failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });

  it("propagates a findExternalRefByInternalId failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveDriblLeagueIds({ deps, leagueId });

    assert(!result.ok);
  });
});
