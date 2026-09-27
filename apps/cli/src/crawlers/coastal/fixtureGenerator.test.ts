import { fixtureStatusValue, type FixtureStatus } from "@matchday/domain";
import { addDays } from "#crawlers/coastal/isoDateMath.ts";
import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { kickoffInstant } from "#crawlers/coastal/kickoffSchedule.ts";
import { findCoastalClub } from "#crawlers/coastal/roster.ts";
import { seasonWindowForYear } from "#crawlers/coastal/seasonCalendar.ts";

const season = seasonWindowForYear(2026);
const midSeason = new Date("2026-11-01T00:00:00.000Z");
const fixtures = generateSeasonFixtures(season, midSeason);

describe("generateSeasonFixtures", () => {
  it("generates 38 rounds of ten matches", () => {
    expect(fixtures).toHaveLength(380);
    for (let round = 1; round <= 38; round += 1) {
      expect(fixtures.filter((fixture) => fixture.round === round)).toHaveLength(10);
    }
  });

  it("gives every fixture a unique key", () => {
    const keys = new Set(fixtures.map((fixture) => fixture.key));
    expect(keys.size).toBe(fixtures.length);
  });

  it("pairs two distinct clubs, played at the home club's ground", () => {
    for (const fixture of fixtures) {
      expect(fixture.homeClubKey).not.toBe(fixture.awayClubKey);
      const home = findCoastalClub(fixture.homeClubKey);
      const away = findCoastalClub(fixture.awayClubKey);
      expect(home).toBeDefined();
      expect(away).toBeDefined();
      expect(fixture.venue).toBe(home?.ground);
    }
  });

  it("is deterministic for the same season and moment", () => {
    expect(generateSeasonFixtures(season, midSeason)).toEqual(fixtures);
  });

  it("only scores a completed match", () => {
    for (const fixture of fixtures) {
      const scored = fixture.homeScore !== null || fixture.awayScore !== null;
      expect(scored).toBe(fixture.status === fixtureStatusValue.completed);
    }
  });

  it("reads scheduled and completed matches from the clock", () => {
    for (const fixture of fixtures) {
      if (fixture.status === fixtureStatusValue.scheduled) {
        expect(fixture.kickoffAt.getTime()).toBeGreaterThan(midSeason.getTime());
      }
      if (
        fixture.status === fixtureStatusValue.completed ||
        fixture.status === fixtureStatusValue.inProgress
      ) {
        expect(fixture.kickoffAt.getTime()).toBeLessThanOrEqual(midSeason.getTime());
      }
    }
  });
});

describe("season events", () => {
  it("covers every status across a few seasons and moments", () => {
    const statuses = new Set<FixtureStatus>();
    for (let seasonIndex = 0; seasonIndex < 4; seasonIndex += 1) {
      const window = seasonWindowForYear(2026 + seasonIndex);
      const liveRounds = [1, 10, 20, 30, 38];
      const moments = [
        new Date(`${window.startsOn}T00:00:00.000Z`),
        new Date(`${addDays(window.startsOn, 150)}T00:00:00.000Z`),
        new Date(`${window.endsOn}T00:00:00.000Z`),
        ...liveRounds.map(
          (round) => new Date(kickoffInstant(window, round, 0).getTime() + 30 * 60 * 1000),
        ),
      ];
      for (const moment of moments) {
        for (const fixture of generateSeasonFixtures(window, moment)) {
          statuses.add(fixture.status);
        }
      }
    }
    expect(statuses).toEqual(
      new Set([
        fixtureStatusValue.scheduled,
        fixtureStatusValue.inProgress,
        fixtureStatusValue.completed,
        fixtureStatusValue.postponed,
        fixtureStatusValue.cancelled,
      ]),
    );
  });

  it("moves a rescheduled match later than its round's slot", () => {
    const moved: { kickoffAt: Date; scheduled: Date; status: FixtureStatus }[] = [];
    for (let seasonIndex = 0; seasonIndex < 4; seasonIndex += 1) {
      const window = seasonWindowForYear(2026 + seasonIndex);
      generateSeasonFixtures(window, midSeason).forEach((fixture, index) => {
        const scheduled = kickoffInstant(window, fixture.round, index % 10);
        if (fixture.kickoffAt.getTime() !== scheduled.getTime()) {
          moved.push({ kickoffAt: fixture.kickoffAt, scheduled, status: fixture.status });
        }
      });
    }

    expect(moved.length).toBeGreaterThan(0);
    for (const fixture of moved) {
      expect(fixture.kickoffAt.getTime()).toBeGreaterThan(fixture.scheduled.getTime());
      expect(fixture.status).not.toBe(fixtureStatusValue.cancelled);
      expect(fixture.status).not.toBe(fixtureStatusValue.postponed);
    }
  });
});
