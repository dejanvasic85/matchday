import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import {
  addDays,
  firstWeekdayOnOrAfter,
  isoDateLiteral,
  weekdayIndex,
} from "#crawlers/coastal/isoDateMath.ts";

describe("addDays", () => {
  it("moves forward across a month boundary", () => {
    expect(addDays(makeIsoDate("2026-10-30"), 5)).toBe("2026-11-04");
  });

  it("moves backward across a year boundary", () => {
    expect(addDays(makeIsoDate("2027-01-02"), -5)).toBe("2026-12-28");
  });

  it("handles a leap day", () => {
    expect(addDays(makeIsoDate("2028-02-28"), 1)).toBe("2028-02-29");
  });

  it("is a no-op for zero days", () => {
    expect(addDays(makeIsoDate("2026-10-02"), 0)).toBe("2026-10-02");
  });
});

describe("weekdayIndex", () => {
  it("identifies the day of week", () => {
    expect(weekdayIndex(makeIsoDate("2026-10-02"))).toBe(5);
    expect(weekdayIndex(makeIsoDate("2026-10-04"))).toBe(0);
  });
});

describe("firstWeekdayOnOrAfter", () => {
  it("returns the day itself when it already matches", () => {
    expect(firstWeekdayOnOrAfter(makeIsoDate("2026-10-02"), 5)).toBe("2026-10-02");
  });

  it("returns the next matching day otherwise", () => {
    expect(firstWeekdayOnOrAfter(makeIsoDate("2026-08-15"), 5)).toBe("2026-08-21");
  });
});

describe("isoDateLiteral", () => {
  it("brands a valid day", () => {
    expect(isoDateLiteral("2026-10-02")).toBe("2026-10-02");
  });

  it("throws on a malformed day", () => {
    expect(() => isoDateLiteral("02/10/2026")).toThrow();
  });
});
