import {
  hasSeasonFinished,
  isIsoDate,
  parseIsoDate,
  todayInMelbourne,
  type IsoDate,
} from "#calendarDate.ts";

/** Validated literal, so a fixture typo fails loudly rather than needing an `as` cast. */
function iso(value: string): IsoDate {
  const parsed = parseIsoDate(value);
  if (parsed === undefined) {
    throw new Error(`Fixture date is not YYYY-MM-DD: ${value}`);
  }
  return parsed;
}

describe("isIsoDate", () => {
  it("accepts a YYYY-MM-DD string", () => {
    expect(isIsoDate("2026-03-01")).toBe(true);
  });

  it("rejects a timestamp, a slashed date and a short year", () => {
    expect(isIsoDate("2026-03-01T00:00:00Z")).toBe(false);
    expect(isIsoDate("2026/03/01")).toBe(false);
    expect(isIsoDate("26-03-01")).toBe(false);
  });
});

describe("todayInMelbourne", () => {
  it("reads the Melbourne day, not the UTC day, across the AEST midnight boundary", () => {
    // 2026-08-01T14:30:00Z is 2026-08-02 00:30 in Melbourne (AEST, UTC+10).
    const instant = new Date("2026-08-01T14:30:00Z");

    expect(todayInMelbourne(instant)).toBe("2026-08-02");
  });

  it("stays on the same day before the Melbourne boundary", () => {
    // 2026-08-01T13:30:00Z is 2026-08-01 23:30 in Melbourne.
    const instant = new Date("2026-08-01T13:30:00Z");

    expect(todayInMelbourne(instant)).toBe("2026-08-01");
  });
});

describe("hasSeasonFinished", () => {
  it("is true once the end date is before today", () => {
    expect(hasSeasonFinished(iso("2026-09-30"), iso("2026-10-01"))).toBe(true);
  });

  it("is false on the end date itself, so a season finishes the day after", () => {
    expect(hasSeasonFinished(iso("2026-09-30"), iso("2026-09-30"))).toBe(false);
  });

  it("is false for a season with no end date", () => {
    expect(hasSeasonFinished(null, iso("2026-10-01"))).toBe(false);
  });
});
