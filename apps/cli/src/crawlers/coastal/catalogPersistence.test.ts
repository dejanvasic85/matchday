import { fixtureStatusValue, ok, serverError, type Source } from "@matchday/domain";
import { persistCatalogSeason } from "#crawlers/coastal/catalogPersistence.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";
import { makeCoastalExternalRefRow, makeCoastalHappyPathDeps } from "#test/fixtures/coastalDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";

const season = seasonWindowForYear(2026);
const now = new Date("2026-06-01T00:00:00.000Z");

describe("persistCatalogSeason", () => {
  it("persists the structure and creates every fixture as scheduled", async () => {
    const deps = makeCoastalHappyPathDeps();

    const result = await persistCatalogSeason(deps, makeFakeLogger(), season, now);

    expect(result).toEqual(
      ok({
        competitions: 1,
        leagues: 1,
        clubs: coastalClubs.length,
        teams: coastalClubs.length,
        fixturesCreated: 380,
      }),
    );
    expect(deps.ensureCompetitionSeason).toHaveBeenCalledWith(
      expect.objectContaining({ startsOn: season.startsOn, endsOn: season.endsOn }),
    );
    expect(deps.upsertLeagueTeam).toHaveBeenCalledTimes(coastalClubs.length);
    expect(deps.upsertFixture).toHaveBeenCalledTimes(380);
    expect(deps.upsertFixture).toHaveBeenCalledWith(
      expect.objectContaining({
        status: fixtureStatusValue.scheduled,
        homeScore: null,
        awayScore: null,
        venue: expect.any(String),
      }),
    );
  });

  it("creates no fixtures when they already exist", async () => {
    const deps = makeCoastalHappyPathDeps({
      findExternalRef: vi
        .fn()
        .mockImplementation((_source: Source, sourceId: string) =>
          Promise.resolve(
            ok(sourceId.startsWith("fixture-") ? makeCoastalExternalRefRow(sourceId) : null),
          ),
        ),
    });

    const result = await persistCatalogSeason(deps, makeFakeLogger(), season, now);

    expect(result).toEqual(
      ok({
        competitions: 1,
        leagues: 1,
        clubs: coastalClubs.length,
        teams: coastalClubs.length,
        fixturesCreated: 0,
      }),
    );
    expect(deps.upsertFixture).not.toHaveBeenCalled();
  });

  it("stops at a failed competition upsert", async () => {
    const deps = makeCoastalHappyPathDeps({
      upsertCompetition: vi.fn().mockResolvedValue(serverError("boom")),
    });

    const result = await persistCatalogSeason(deps, makeFakeLogger(), season, now);

    expect(result.ok).toBe(false);
    expect(deps.upsertSeason).not.toHaveBeenCalled();
  });
});
