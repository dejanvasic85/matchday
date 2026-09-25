import { toSeasonSummary } from "#services/seasonService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

describe("toSeasonSummary", () => {
  it("keeps the calendar fields and drops the timestamp columns", () => {
    const summary = toSeasonSummary({
      id: "sea_2026000000",
      name: "2026",
      startsOn: makeIsoDate("2026-03-01"),
      endsOn: makeIsoDate("2026-09-30"),
    });

    expect(summary).toEqual({
      id: "sea_2026000000",
      name: "2026",
      startsOn: makeIsoDate("2026-03-01"),
      endsOn: makeIsoDate("2026-09-30"),
    });
  });

  it("carries null dates through for a season still missing them", () => {
    const summary = toSeasonSummary({
      id: "sea_2027000000",
      name: "2027",
      startsOn: null,
      endsOn: null,
    });

    expect(summary).toEqual({
      id: "sea_2027000000",
      name: "2027",
      startsOn: null,
      endsOn: null,
    });
  });
});
