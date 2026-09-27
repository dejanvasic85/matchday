import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import { melbourneInstant, melbourneWallClock } from "#crawlers/coastal/melbourneTime.ts";

describe("melbourneInstant", () => {
  it("resolves summer wall time at UTC+11", () => {
    expect(melbourneInstant(makeIsoDate("2027-01-15"), 13, 0).toISOString()).toBe(
      "2027-01-15T02:00:00.000Z",
    );
  });

  it("resolves winter wall time at UTC+10", () => {
    expect(melbourneInstant(makeIsoDate("2027-07-15"), 13, 0).toISOString()).toBe(
      "2027-07-15T03:00:00.000Z",
    );
  });

  it("handles the day the daylight-saving change lands", () => {
    expect(melbourneInstant(makeIsoDate("2026-10-02"), 19, 30).toISOString()).toBe(
      "2026-10-02T09:30:00.000Z",
    );
    expect(melbourneInstant(makeIsoDate("2026-10-04"), 13, 0).toISOString()).toBe(
      "2026-10-04T02:00:00.000Z",
    );
  });
});

describe("melbourneWallClock", () => {
  it("reads back exactly what was constructed", () => {
    const instant = melbourneInstant(makeIsoDate("2026-10-04"), 15, 0);
    expect(melbourneWallClock(instant)).toEqual({
      date: "2026-10-04",
      hour: 15,
      minute: 0,
    });
  });
});
