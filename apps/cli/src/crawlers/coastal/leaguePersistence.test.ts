import { fixtureStatusValue, ok, serverError } from "@matchday/domain";
import { persistLeagueSeason } from "#crawlers/coastal/leaguePersistence.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";
import { makeCoastalHappyPathDeps } from "#test/fixtures/coastalDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";

const season = seasonWindowForYear(2026);
const afterSeason = new Date("2027-06-01T00:00:00.000Z");
const input = {
  competitionId: "cmp_abc123",
  seasonId: "sea_abc123",
  leagueId: "lea_abc123",
  season,
} as const;

describe("persistLeagueSeason", () => {
  it("persists every fixture and the full ladder", async () => {
    const deps = makeCoastalHappyPathDeps();

    const result = await persistLeagueSeason(deps, makeFakeLogger(), input, afterSeason);

    expect(result).toEqual(ok({ fixtures: 380, tableEntries: coastalClubs.length }));
    expect(deps.upsertFixture).toHaveBeenCalledTimes(380);
    expect(deps.upsertTableEntry).toHaveBeenCalledTimes(coastalClubs.length);

    const positions = vi
      .mocked(deps.upsertTableEntry)
      .mock.calls.map(([values]) => values.position)
      .sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: coastalClubs.length }, (_, index) => index + 1));
  });

  it("reveals scores once the matches are in the past", async () => {
    const deps = makeCoastalHappyPathDeps();

    await persistLeagueSeason(deps, makeFakeLogger(), input, afterSeason);

    const fixtures = vi.mocked(deps.upsertFixture).mock.calls.map(([values]) => values);
    const completed = fixtures.filter((fixture) => fixture.status === fixtureStatusValue.completed);
    expect(completed.length).toBeGreaterThan(0);
    for (const fixture of completed) {
      expect(fixture.homeScore).not.toBeNull();
      expect(fixture.awayScore).not.toBeNull();
    }

    const played = vi
      .mocked(deps.upsertTableEntry)
      .mock.calls.reduce((total, [values]) => total + values.played, 0);
    expect(played).toBe(completed.length * 2);
  });

  it("stops at a failed fixture upsert", async () => {
    const deps = makeCoastalHappyPathDeps({
      upsertFixture: vi.fn().mockResolvedValue(serverError("boom")),
    });

    const result = await persistLeagueSeason(deps, makeFakeLogger(), input, afterSeason);

    expect(result.ok).toBe(false);
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });
});
