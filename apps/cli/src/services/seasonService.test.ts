import { toSeasonWindowSummary } from "#services/seasonService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

describe("toSeasonWindowSummary", () => {
  it("keeps the source, season, competition and window fields", () => {
    const summary = toSeasonWindowSummary({
      source: "dribl",
      seasonId: "sea_2026000000",
      seasonName: "2026",
      competitionId: "cmp_npl0000000",
      competitionName: "NPL Victoria",
      startsOn: makeIsoDate("2026-02-01"),
      endsOn: makeIsoDate("2026-09-30"),
    });

    expect(summary).toEqual({
      source: "dribl",
      seasonId: "sea_2026000000",
      seasonName: "2026",
      competitionId: "cmp_npl0000000",
      competitionName: "NPL Victoria",
      startsOn: makeIsoDate("2026-02-01"),
      endsOn: makeIsoDate("2026-09-30"),
    });
  });

  it("carries null dates through for a window still missing them", () => {
    const summary = toSeasonWindowSummary({
      source: "dribl",
      seasonId: "sea_2026spring",
      seasonName: "2026 Spring",
      competitionId: "cmp_coastal000",
      competitionName: "Coastal Premier League",
      startsOn: null,
      endsOn: null,
    });

    expect(summary).toEqual({
      source: "dribl",
      seasonId: "sea_2026spring",
      seasonName: "2026 Spring",
      competitionId: "cmp_coastal000",
      competitionName: "Coastal Premier League",
      startsOn: null,
      endsOn: null,
    });
  });
});
