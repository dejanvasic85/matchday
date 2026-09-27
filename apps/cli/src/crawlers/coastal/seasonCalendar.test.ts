import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import {
  seasonKey,
  seasonNameForYear,
  seasonStartForYear,
  seasonWindowForYear,
  seasonsAt,
  seasonsToGenerate,
} from "#crawlers/coastal/seasonCalendar.ts";

describe("seasonStartForYear", () => {
  it("starts on the first Friday on or after mid-August", () => {
    expect(seasonStartForYear(2026)).toBe("2026-08-21");
    expect(seasonStartForYear(2027)).toBe("2027-08-20");
  });
});

describe("seasonNameForYear", () => {
  it("names the season across the two years it runs", () => {
    expect(seasonNameForYear(2026)).toBe("2026-27");
    expect(seasonNameForYear(2027)).toBe("2027-28");
  });
});

describe("seasonWindowForYear", () => {
  it("runs from August into May the following year", () => {
    expect(seasonWindowForYear(2026)).toEqual({
      name: "2026-27",
      startsOn: "2026-08-21",
      endsOn: "2027-05-09",
    });
  });

  it("accounts for a leap year in the end date", () => {
    expect(seasonWindowForYear(2027)).toEqual({
      name: "2027-28",
      startsOn: "2027-08-20",
      endsOn: "2028-05-07",
    });
  });

  it("spans two calendar years", () => {
    const season = seasonWindowForYear(2026);
    expect(season.startsOn.slice(0, 4)).not.toBe(season.endsOn.slice(0, 4));
  });
});

describe("seasonKey", () => {
  it("slugifies the name", () => {
    expect(seasonKey(seasonWindowForYear(2026))).toBe("2026-27");
  });
});

describe("seasonsAt", () => {
  it("finds the running season after it starts", () => {
    const { running, next } = seasonsAt(makeIsoDate("2026-10-01"));
    expect(running?.name).toBe("2026-27");
    expect(next.name).toBe("2027-28");
  });

  it("keeps last year's season running into the new year", () => {
    const { running } = seasonsAt(makeIsoDate("2027-01-15"));
    expect(running?.name).toBe("2026-27");
  });

  it("counts the last day as running and the day after as off-season", () => {
    expect(seasonsAt(makeIsoDate("2027-05-09")).running?.name).toBe("2026-27");

    const offSeason = seasonsAt(makeIsoDate("2027-05-10"));
    expect(offSeason.running).toBeNull();
    expect(offSeason.next.name).toBe("2027-28");
  });

  it("is off-season through June, July and early August", () => {
    for (const day of ["2027-06-15", "2027-07-15", "2027-08-14"]) {
      expect(seasonsAt(makeIsoDate(day)).running).toBeNull();
    }
    expect(seasonsAt(makeIsoDate("2027-08-14")).next.name).toBe("2027-28");
  });

  it("starts the new season on its first Friday", () => {
    expect(seasonsAt(makeIsoDate("2027-08-20")).running?.name).toBe("2027-28");
  });

  it("returns the first season before the association's first kickoff", () => {
    const { running, next } = seasonsAt(makeIsoDate("2026-08-14"));
    expect(running).toBeNull();
    expect(next.name).toBe("2026-27");
  });
});

describe("seasonsToGenerate", () => {
  it("generates the running season while it plays", () => {
    expect(seasonsToGenerate(makeIsoDate("2027-02-01")).map((season) => season.name)).toEqual([
      "2026-27",
    ]);
  });

  it("generates the next season over the off-season", () => {
    expect(seasonsToGenerate(makeIsoDate("2027-06-20")).map((season) => season.name)).toEqual([
      "2027-28",
    ]);
  });
});
