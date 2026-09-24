import { ok, serverError } from "@matchday/domain";
import { setSeasonDates, type SeasonDateServiceDeps } from "#services/seasonDateService.ts";

function makeDeps(overrides: Partial<SeasonDateServiceDeps> = {}): SeasonDateServiceDeps {
  return {
    setSeasonDatesByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "sea_2026000000", name: "2026", startsOn: null, endsOn: null })),
    ...overrides,
  };
}

describe("setSeasonDates", () => {
  it("writes the dates to the named season", async () => {
    const deps = makeDeps();

    const result = await setSeasonDates(deps, "2026", "2026-03-01", "2026-09-30");

    expect(result).toEqual(
      ok({ seasonName: "2026", startsOn: "2026-03-01", endsOn: "2026-09-30" }),
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

  it("returns null when no season has that name", async () => {
    const deps = makeDeps({ setSeasonDatesByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await setSeasonDates(deps, "2099", "2099-03-01", "2099-09-30");

    expect(result).toEqual(ok(null));
  });

  it("propagates a write failure", async () => {
    const writeError = serverError("Failed to set season dates");
    const deps = makeDeps({ setSeasonDatesByName: vi.fn().mockResolvedValue(writeError) });

    const result = await setSeasonDates(deps, "2026", "2026-03-01", "2026-09-30");

    expect(result).toEqual(writeError);
  });
});
