import { fixtureStatusValue } from "@matchday/domain";
import { generateCoastalSeason } from "#crawlers/coastal/coastalGenerator.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";

const season = seasonWindowForYear(2026);
const now = new Date("2027-06-01T00:00:00.000Z");

describe("generateCoastalSeason", () => {
  it("returns the season, its fixtures and a full ladder", () => {
    const generated = generateCoastalSeason(season, now);
    expect(generated.season).toEqual(season);
    expect(generated.fixtures).toHaveLength(380);
    expect(generated.ladder).toHaveLength(20);
    expect(generated.ladder.map((row) => row.position)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("orders the ladder by points, highest first", () => {
    const { ladder } = generateCoastalSeason(season, now);
    const points = ladder.map((row) => row.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it("ends the season with every match decided", () => {
    const { fixtures } = generateCoastalSeason(season, now);
    for (const fixture of fixtures) {
      expect([
        fixtureStatusValue.completed,
        fixtureStatusValue.postponed,
        fixtureStatusValue.cancelled,
      ]).toContain(fixture.status);
    }
  });

  it("is deterministic", () => {
    expect(generateCoastalSeason(season, now)).toEqual(generateCoastalSeason(season, now));
  });
});
