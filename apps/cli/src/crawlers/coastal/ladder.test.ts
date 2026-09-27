import { fixtureStatusValue } from "@matchday/domain";
import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { buildLadder } from "#crawlers/coastal/ladder.ts";
import { coastalClubs } from "#crawlers/coastal/roster.ts";
import type { CoastalFixture } from "#crawlers/coastal/schemas.ts";
import { seasonWindowForIndex } from "#crawlers/coastal/seasonCalendar.ts";

function makeFixture(overrides: Partial<CoastalFixture>): CoastalFixture {
  return {
    key: "fixture",
    round: 1,
    homeClubKey: "stadly-united",
    awayClubKey: "harbourside",
    kickoffAt: new Date("2026-10-02T09:30:00.000Z"),
    venue: "Stadly Park",
    status: fixtureStatusValue.completed,
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  };
}

function rowFor(fixtures: CoastalFixture[], clubKey: string) {
  const row = buildLadder(fixtures).find((candidate) => candidate.clubKey === clubKey);
  if (row === undefined) {
    throw new Error(`No ladder row for ${clubKey}`);
  }
  return row;
}

describe("buildLadder", () => {
  it("awards three points for a win", () => {
    const fixtures = [makeFixture({ homeClubKey: "stadly-united", awayClubKey: "harbourside" })];
    expect(rowFor(fixtures, "stadly-united")).toMatchObject({ played: 1, won: 1, points: 3 });
    expect(rowFor(fixtures, "harbourside")).toMatchObject({ played: 1, lost: 1, points: 0 });
  });

  it("awards one point each for a draw", () => {
    const fixtures = [makeFixture({ homeScore: 2, awayScore: 2 })];
    expect(rowFor(fixtures, "stadly-united")).toMatchObject({ drawn: 1, points: 1 });
    expect(rowFor(fixtures, "harbourside")).toMatchObject({ drawn: 1, points: 1 });
  });

  it("tracks goals for, against and difference", () => {
    const fixtures = [makeFixture({ homeScore: 3, awayScore: 1 })];
    expect(rowFor(fixtures, "stadly-united")).toMatchObject({
      goalsFor: 3,
      goalsAgainst: 1,
      goalDifference: 2,
    });
    expect(rowFor(fixtures, "harbourside")).toMatchObject({
      goalsFor: 1,
      goalsAgainst: 3,
      goalDifference: -2,
    });
  });

  it("ignores matches that are not completed", () => {
    const fixtures = [
      makeFixture({ status: fixtureStatusValue.scheduled, homeScore: null, awayScore: null }),
      makeFixture({ status: fixtureStatusValue.postponed, homeScore: null, awayScore: null }),
      makeFixture({ status: fixtureStatusValue.cancelled, homeScore: null, awayScore: null }),
    ];
    expect(rowFor(fixtures, "stadly-united").played).toBe(0);
  });

  it("ranks by points, then goal difference", () => {
    const fixtures = [
      makeFixture({
        homeClubKey: "stadly-united",
        awayClubKey: "harbourside",
        homeScore: 3,
        awayScore: 0,
      }),
      makeFixture({
        homeClubKey: "kingsmere-rovers",
        awayClubKey: "ashvale-city",
        homeScore: 1,
        awayScore: 0,
      }),
    ];
    const ladder = buildLadder(fixtures);
    const positionOf = (clubKey: string) =>
      ladder.find((row) => row.clubKey === clubKey)?.position ?? 0;

    expect(positionOf("stadly-united")).toBeLessThan(positionOf("kingsmere-rovers"));
    expect(positionOf("kingsmere-rovers")).toBeLessThan(positionOf("harbourside"));
    expect(positionOf("harbourside")).toBe(ladder.length);
  });

  it("gives every club a row and a position", () => {
    const ladder = buildLadder([]);
    expect(ladder).toHaveLength(coastalClubs.length);
    expect(ladder.map((row) => row.position)).toEqual(
      Array.from({ length: coastalClubs.length }, (_, index) => index + 1),
    );
  });

  it("accounts for every completed match over a full season", () => {
    const season = seasonWindowForIndex(0);
    const fixtures = generateSeasonFixtures(season, new Date("2027-03-01T00:00:00.000Z"));
    const completed = fixtures.filter(
      (fixture) => fixture.status === fixtureStatusValue.completed,
    ).length;
    const ladder = buildLadder(fixtures);
    const played = ladder.reduce((total, row) => total + row.played, 0);
    expect(played).toBe(completed * 2);
  });
});
