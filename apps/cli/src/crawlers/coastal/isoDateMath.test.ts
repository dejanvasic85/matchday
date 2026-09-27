import { makeIsoDate } from "#test/fixtures/calendarDate.ts";
import {
  addDays,
  differenceInDays,
  isWithinRange,
  isoDateLiteral,
  weekdayIndex,
  weekdayName,
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

describe("differenceInDays", () => {
  it("counts whole days forward", () => {
    expect(differenceInDays(makeIsoDate("2026-10-02"), makeIsoDate("2026-10-02"))).toBe(0);
    expect(differenceInDays(makeIsoDate("2026-10-02"), makeIsoDate("2026-10-12"))).toBe(10);
  });

  it("is negative when the second date is earlier", () => {
    expect(differenceInDays(makeIsoDate("2026-10-12"), makeIsoDate("2026-10-02"))).toBe(-10);
  });
});

describe("weekday", () => {
  it("identifies the day of week", () => {
    expect(weekdayIndex(makeIsoDate("2026-10-02"))).toBe(5);
    expect(weekdayName(makeIsoDate("2026-10-02"))).toBe("Fri");
    expect(weekdayName(makeIsoDate("2026-10-04"))).toBe("Sun");
  });
});

describe("isWithinRange", () => {
  const startsOn = makeIsoDate("2026-10-02");
  const endsOn = makeIsoDate("2026-12-27");

  it("includes both ends", () => {
    expect(isWithinRange(startsOn, startsOn, endsOn)).toBe(true);
    expect(isWithinRange(endsOn, startsOn, endsOn)).toBe(true);
  });

  it("excludes days outside", () => {
    expect(isWithinRange(makeIsoDate("2026-10-01"), startsOn, endsOn)).toBe(false);
    expect(isWithinRange(makeIsoDate("2026-12-28"), startsOn, endsOn)).toBe(false);
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
