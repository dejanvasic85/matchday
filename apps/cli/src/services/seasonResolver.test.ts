import { ok, serverError } from "@matchday/domain";
import { resolveSeason, type SeasonResolverDeps } from "#services/seasonResolver.ts";

function makeSeason(name: string, id: string) {
  return {
    id,
    source: "dribl" as const,
    name,
    startsOn: null,
    endsOn: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeDeps(overrides: Partial<SeasonResolverDeps> = {}): SeasonResolverDeps {
  return {
    findLatestSeason: vi.fn().mockResolvedValue(ok(makeSeason("2026", "sea_2026000000"))),
    findSeasonByName: vi.fn().mockResolvedValue(ok(makeSeason("2027", "sea_2027000000"))),
    ...overrides,
  };
}

describe("resolveSeason", () => {
  it("returns the source's latest season when no name is given", async () => {
    const deps = makeDeps();

    const result = await resolveSeason(deps, "dribl");

    expect(result).toEqual(ok({ id: "sea_2026000000", source: "dribl", name: "2026" }));
    expect(deps.findLatestSeason).toHaveBeenCalledWith("dribl");
    expect(deps.findSeasonByName).not.toHaveBeenCalled();
  });

  it("returns the named season scoped to the source", async () => {
    const deps = makeDeps();

    const result = await resolveSeason(deps, "dribl", "2027");

    expect(result).toEqual(ok({ id: "sea_2027000000", source: "dribl", name: "2027" }));
    expect(deps.findSeasonByName).toHaveBeenCalledWith("dribl", "2027");
    expect(deps.findLatestSeason).not.toHaveBeenCalled();
  });

  it("fails on an unknown season name rather than falling back to the latest", async () => {
    const deps = makeDeps({ findSeasonByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await resolveSeason(deps, "dribl", "20227");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('No season named "20227"');
    }
  });

  it("fails when the source has no seasons at all", async () => {
    const deps = makeDeps({ findLatestSeason: vi.fn().mockResolvedValue(ok(null)) });

    const result = await resolveSeason(deps, "dribl");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("No seasons exist yet");
    }
  });

  it("errors when the season row id lacks the sea_ prefix", async () => {
    const deps = makeDeps({
      findLatestSeason: vi.fn().mockResolvedValue(ok(makeSeason("2026", "lea_wrong00000"))),
    });

    const result = await resolveSeason(deps, "dribl");

    expect(result.ok).toBe(false);
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to find latest season");
    const deps = makeDeps({ findLatestSeason: vi.fn().mockResolvedValue(lookupError) });

    const result = await resolveSeason(deps, "dribl");

    expect(result).toEqual(lookupError);
  });
});
