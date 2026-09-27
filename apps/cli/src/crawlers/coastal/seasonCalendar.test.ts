import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import {
  seasonKey,
  seasonNameForStart,
  seasonWindowForIndex,
  seasonsAt,
  seasonsToGenerate,
} from "#crawlers/coastal/seasonCalendar.ts";

describe("seasonWindowForIndex", () => {
  it("starts the first season on the anchor Friday", () => {
    const season = seasonWindowForIndex(0);
    expect(season).toEqual({
      name: "2026 Spring",
      startsOn: "2026-10-02",
      endsOn: "2026-12-27",
    });
  });

  it("names the second season by the summer it starts in", () => {
    expect(seasonWindowForIndex(1)).toEqual({
      name: "2027 Summer",
      startsOn: "2027-01-15",
      endsOn: "2027-04-11",
    });
  });

  it("tiles seasons 105 days apart", () => {
    expect(seasonWindowForIndex(2).startsOn).toBe("2027-04-30");
    expect(seasonWindowForIndex(3).startsOn).toBe("2027-08-13");
    expect(seasonWindowForIndex(4).startsOn).toBe("2027-11-26");
  });
});

describe("seasonNameForStart", () => {
  it("labels a start by its season of the year", () => {
    expect(seasonNameForStart(makeIsoDate("2026-10-02"))).toBe("2026 Spring");
    expect(seasonNameForStart(makeIsoDate("2027-01-15"))).toBe("2027 Summer");
    expect(seasonNameForStart(makeIsoDate("2027-04-30"))).toBe("2027 Autumn");
    expect(seasonNameForStart(makeIsoDate("2027-08-13"))).toBe("2027 Winter");
  });
});

describe("seasonKey", () => {
  it("slugifies the name", () => {
    expect(seasonKey(seasonWindowForIndex(0))).toBe("2026-spring");
  });
});

describe("seasonsAt", () => {
  it("finds the running season and the next one", () => {
    const { running, next } = seasonsAt(makeIsoDate("2026-10-15"));
    expect(running?.name).toBe("2026 Spring");
    expect(next.name).toBe("2027 Summer");
  });

  it("counts both the first and last day as running", () => {
    const season = seasonWindowForIndex(0);
    expect(seasonsAt(season.startsOn).running?.name).toBe("2026 Spring");
    expect(seasonsAt(season.endsOn).running?.name).toBe("2026 Spring");
  });

  it("returns only the next season during the break", () => {
    const { running, next } = seasonsAt(makeIsoDate("2026-12-28"));
    expect(running).toBeNull();
    expect(next.name).toBe("2027 Summer");
  });

  it("returns the first season before the anchor", () => {
    const { running, next } = seasonsAt(makeIsoDate("2026-09-01"));
    expect(running).toBeNull();
    expect(next.name).toBe("2026 Spring");
  });
});

describe("seasonsToGenerate", () => {
  it("generates the running season while it plays", () => {
    expect(seasonsToGenerate(makeIsoDate("2026-11-01")).map((season) => season.name)).toEqual([
      "2026 Spring",
    ]);
  });

  it("generates the next season during the break", () => {
    expect(seasonsToGenerate(makeIsoDate("2027-01-01")).map((season) => season.name)).toEqual([
      "2027 Summer",
    ]);
  });
});
