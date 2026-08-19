import { fixtureStatusValue, ok } from "@matchday/domain";
import type { MappedFixture } from "#crawlers/dribl/mappers/mapDriblFixture.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { resolveFixtureEntities } from "#crawlers/dribl/fixtureEntityResolver.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeMappedFixture(overrides: Partial<MappedFixture> = {}): MappedFixture {
  return {
    sourceId: "fixture-source-1",
    round: 1,
    competitionName: "Coles MiniRoos Mixed Sunday (U6 - U11)",
    leagueName: "League",
    homeTeamName: "Home",
    homeTeamSourceId: "home-source-1",
    homeTeamLogoUrl: null,
    awayTeamName: "Away",
    awayTeamSourceId: "away-source-1",
    awayTeamLogoUrl: null,
    venue: "AB Shaw Reserve",
    latitude: -37.865571,
    longitude: 144.783747,
    kickoffAt: epoch,
    status: fixtureStatusValue.scheduled,
    unmappedStatus: null,
    homeScore: null,
    awayScore: null,
    isBye: false,
    ...overrides,
  };
}

function makeExternalRefRow(internalId: string, sourceId: string) {
  return {
    id: "ext_row0000001",
    entityType: "team" as const,
    internalId,
    source: "dribl" as const,
    sourceId,
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

const context = {
  competitionId: "cmp_abc123" as const,
  seasonId: "sea_abc123" as const,
  leagueId: "lea_abc123" as const,
};

describe("resolveFixtureEntities", () => {
  it("resolves known home/away teams and upserts the fixture", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockImplementation((_source: string, sourceId: string) => {
        if (sourceId === "home-source-1") {
          return Promise.resolve(ok(makeExternalRefRow("tea_home00000001", sourceId)));
        }
        if (sourceId === "away-source-1") {
          return Promise.resolve(ok(makeExternalRefRow("tea_away00000001", sourceId)));
        }
        return Promise.resolve(ok(null));
      }),
      upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
      upsertExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow("mtc_new00000001", "fixture-source-1"))),
    });

    const result = await resolveFixtureEntities(
      deps,
      makeFakeLogger(),
      makeMappedFixture(),
      context,
    );

    assert(result.ok);
    expect(deps.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({
        homeTeamId: "tea_home00000001",
        awayTeamId: "tea_away00000001",
        leagueId: "lea_abc123",
        competitionId: "cmp_abc123",
        seasonId: "sea_abc123",
        latitude: "-37.865571",
        longitude: "144.783747",
      }),
    );
  });

  it("creates unlinked teams (no club) for a fixture whose teams haven't been seen yet", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_new00000001", clubId: null })),
      upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
      upsertExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow("mtc_new00000001", "fixture-source-1"))),
    });

    await resolveFixtureEntities(deps, makeFakeLogger(), makeMappedFixture(), context);

    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: null, name: "Home" }),
    );
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: null, name: "Away" }),
    );
    expect(deps.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({
        homeTeamId: expect.stringMatching(/^tea_/),
        awayTeamId: expect.stringMatching(/^tea_/),
      }),
    );
  });

  it("leaves homeTeamId/awayTeamId null for a placeholder fixture with no team names", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
      upsertExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow("mtc_new00000001", "fixture-source-1"))),
    });

    await resolveFixtureEntities(
      deps,
      makeFakeLogger(),
      makeMappedFixture({
        homeTeamSourceId: null,
        homeTeamName: null,
        awayTeamSourceId: null,
        awayTeamName: null,
      }),
      context,
    );

    expect(deps.upsertTeam).not.toHaveBeenCalled();
    expect(deps.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({ homeTeamId: null, awayTeamId: null }),
    );
  });

  it("skips team resolution entirely for a bye with a null opponent source id", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow("tea_home00000001", "home-source-1"))),
      upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
      upsertExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow("mtc_new00000001", "fixture-source-1"))),
    });

    await resolveFixtureEntities(
      deps,
      makeFakeLogger(),
      makeMappedFixture({ awayTeamSourceId: null, awayTeamName: null, isBye: true }),
      context,
    );

    expect(deps.findExternalRef).toHaveBeenCalledTimes(2); // home team + fixture lookup, not away
  });

  it("propagates a home-team resolution failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveFixtureEntities(
      deps,
      makeFakeLogger(),
      makeMappedFixture(),
      context,
    );

    assert(!result.ok);
    expect(deps.upsertFixture).not.toHaveBeenCalled();
  });
});
