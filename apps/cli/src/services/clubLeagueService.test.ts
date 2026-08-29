import { badRequest, notFound, ok, serverError } from "@matchday/domain";
import { listLeaguesForClub, type ClubLeagueServiceDeps } from "#services/clubLeagueService.ts";

function makeDeps(overrides: Partial<ClubLeagueServiceDeps> = {}): ClubLeagueServiceDeps {
  return {
    findClubsByName: vi
      .fn()
      .mockResolvedValue(ok([{ id: "clb_existing000", name: "Williamstown SC" }])),
    listLeaguesByClubId: vi
      .fn()
      .mockResolvedValue(ok([{ id: "lea_div1north", name: "Div 1 North" }])),
    ...overrides,
  };
}

describe("listLeaguesForClub", () => {
  it("returns the resolved club with its distinct leagues", async () => {
    const deps = makeDeps();

    const result = await listLeaguesForClub(deps, "Williamstown");

    expect(result).toEqual(
      ok({
        club: { id: "clb_existing000", name: "Williamstown SC" },
        leagues: [{ id: "lea_div1north", name: "Div 1 North" }],
      }),
    );
    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_existing000", undefined);
  });

  it("passes the season through so callers can scope a club to one season", async () => {
    const deps = makeDeps();

    await listLeaguesForClub(deps, "Williamstown", "sea_2026000000");

    expect(deps.listLeaguesByClubId).toHaveBeenCalledWith("clb_existing000", "sea_2026000000");
  });

  it("dedupes leagues shared by more than one team (19 teams, 18 distinct leagues)", async () => {
    const rows = Array.from({ length: 18 }, (_, index) => ({
      id: `lea_league${String(index).padStart(4, "0")}`,
      name: `League ${String(index).padStart(2, "0")}`,
    }));
    // A 19th team plays in the same league as the first — one row per (team, league) pair, so
    // this league appears twice in the raw join result.
    const deps = makeDeps({
      listLeaguesByClubId: vi.fn().mockResolvedValue(ok([...rows, rows[0]])),
    });

    const result = await listLeaguesForClub(deps, "Williamstown");

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.leagues).toHaveLength(18);
  });

  it("returns an empty league list for a club with no table entries yet, not an error", async () => {
    const deps = makeDeps({ listLeaguesByClubId: vi.fn().mockResolvedValue(ok([])) });

    const result = await listLeaguesForClub(deps, "Williamstown");

    expect(result).toEqual(
      ok({ club: { id: "clb_existing000", name: "Williamstown SC" }, leagues: [] }),
    );
  });

  it("returns not found rather than guessing when no club matches", async () => {
    const deps = makeDeps({ findClubsByName: vi.fn().mockResolvedValue(ok([])) });

    const result = await listLeaguesForClub(deps, "Nonexistent FC");

    expect(result).toEqual(notFound('No club matches "Nonexistent FC"'));
    expect(deps.listLeaguesByClubId).not.toHaveBeenCalled();
  });

  it("fails on an ambiguous club match without listing leagues for either candidate", async () => {
    const deps = makeDeps({
      findClubsByName: vi.fn().mockResolvedValue(
        ok([
          { id: "clb_williams0001", name: "Williamstown SC" },
          { id: "clb_williams0002", name: "Williamstown Juniors" },
        ]),
      ),
    });

    const result = await listLeaguesForClub(deps, "Williams");

    expect(result).toEqual(
      badRequest(
        '"Williams" matches more than one club — candidates: Williamstown SC (clb_williams0001), ' +
          "Williamstown Juniors (clb_williams0002)",
      ),
    );
    expect(deps.listLeaguesByClubId).not.toHaveBeenCalled();
  });

  it("propagates a league lookup failure", async () => {
    const lookupError = serverError("Failed to list leagues by club id");
    const deps = makeDeps({ listLeaguesByClubId: vi.fn().mockResolvedValue(lookupError) });

    const result = await listLeaguesForClub(deps, "Williamstown");

    expect(result).toEqual(lookupError);
  });
});
