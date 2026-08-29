import { ok, serverError } from "@matchday/domain";
import { resolveSeason, type SeasonResolverDeps } from "#services/seasonResolver.ts";

function makeDeps(overrides: Partial<SeasonResolverDeps> = {}): SeasonResolverDeps {
  return {
    findLatestSeason: vi.fn().mockResolvedValue(ok({ id: "sea_2026000000", name: "2026" })),
    findSeasonByName: vi.fn().mockResolvedValue(ok({ id: "sea_2027000000", name: "2027" })),
    ...overrides,
  };
}

describe("resolveSeason", () => {
  it("returns the latest season when no name is given", async () => {
    const deps = makeDeps();

    const result = await resolveSeason(deps);

    expect(result).toEqual(ok({ id: "sea_2026000000", name: "2026" }));
    expect(deps.findSeasonByName).not.toHaveBeenCalled();
  });

  it("returns the named season when one is given", async () => {
    const deps = makeDeps();

    const result = await resolveSeason(deps, "2027");

    expect(result).toEqual(ok({ id: "sea_2027000000", name: "2027" }));
    expect(deps.findSeasonByName).toHaveBeenCalledWith("2027");
    expect(deps.findLatestSeason).not.toHaveBeenCalled();
  });

  it("fails on an unknown season name rather than falling back to the latest", async () => {
    const deps = makeDeps({ findSeasonByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await resolveSeason(deps, "20227");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No season named "20227"');
    }
  });

  it("fails when no seasons exist at all", async () => {
    const deps = makeDeps({ findLatestSeason: vi.fn().mockResolvedValue(ok(null)) });

    const result = await resolveSeason(deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("No seasons exist yet");
    }
  });

  it("errors when the season row id lacks the sea_ prefix", async () => {
    const deps = makeDeps({
      findLatestSeason: vi.fn().mockResolvedValue(ok({ id: "lea_wrong00000", name: "2026" })),
    });

    const result = await resolveSeason(deps);

    expect(result.ok).toBe(false);
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to find latest season");
    const deps = makeDeps({ findLatestSeason: vi.fn().mockResolvedValue(lookupError) });

    const result = await resolveSeason(deps);

    expect(result).toEqual(lookupError);
  });
});
