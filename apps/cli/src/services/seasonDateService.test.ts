import { ok, serverError } from "@matchday/domain";
import { setSeasonDates, type SeasonDateServiceDeps } from "#services/seasonDateService.ts";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

function makeDeps(overrides: Partial<SeasonDateServiceDeps> = {}): SeasonDateServiceDeps {
  return {
    setSeasonDatesByName: vi.fn().mockResolvedValue(
      ok({
        status: "written",
        season: {
          id: "sea_2026000000",
          name: "2026",
          startsOn: null,
          endsOn: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    ),
    ...overrides,
  };
}

describe("setSeasonDates", () => {
  it("writes the dates to the named season", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, "2026", "2026-03-01", "2026-09-30");

    expect(result).toEqual(
      ok({
        status: "written",
        seasonName: "2026",
        startsOn: makeIsoDate("2026-03-01"),
        endsOn: makeIsoDate("2026-09-30"),
      }),
    );
    expect(deps.setSeasonDatesByName).toHaveBeenCalledWith("2026", "2026-03-01", "2026-09-30");
  });

  it("fails on a malformed date before touching the database", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, "2026", "1 Mar 2026", "2026-09-30");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("YYYY-MM-DD");
    }
    expect(deps.setSeasonDatesByName).not.toHaveBeenCalled();
  });

  it("fails when the end date is before the start date", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, "2026", "2026-09-30", "2026-03-01");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("before --starts");
    }
    expect(deps.setSeasonDatesByName).not.toHaveBeenCalled();
  });

  it("reports a missing season rather than writing nothing silently", async () => {
    const deps = makeDeps({
      setSeasonDatesByName: vi.fn().mockResolvedValue(ok({ status: "missing" })),
    });

    const result = await setSeasonDates(deps, "2099", "2099-03-01", "2099-09-30");

    expect(result).toEqual(ok({ status: "missing" }));
  });

  it("reports an ambiguous season name with the match count", async () => {
    const deps = makeDeps({
      setSeasonDatesByName: vi.fn().mockResolvedValue(ok({ status: "ambiguous", count: 2 })),
    });

    const result = await setSeasonDates(deps, "2026", "2026-03-01", "2026-09-30");

    expect(result).toEqual(ok({ status: "ambiguous", count: 2 }));
  });

  it("propagates a write failure", async () => {
    const writeError = serverError("Failed to set season dates");
    const deps = makeDeps({ setSeasonDatesByName: vi.fn().mockResolvedValue(writeError) });

    const result = await setSeasonDates(deps, "2026", "2026-03-01", "2026-09-30");

    expect(result).toEqual(writeError);
  });
});
