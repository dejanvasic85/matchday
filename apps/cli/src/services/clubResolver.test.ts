import { badRequest, notFound, ok, serverError } from "@matchday/domain";
import { resolveClub, type ClubResolverDeps } from "#services/clubResolver.ts";

function makeDeps(overrides: Partial<ClubResolverDeps> = {}): ClubResolverDeps {
  return {
    findClubsByName: vi
      .fn()
      .mockResolvedValue(ok([{ id: "clb_existing000", name: "Williamstown SC" }])),
    ...overrides,
  };
}

describe("resolveClub", () => {
  it("returns the single matching club", async () => {
    const deps = makeDeps();

    const result = await resolveClub(deps, "Williamstown");

    expect(result).toEqual(ok({ id: "clb_existing000", name: "Williamstown SC" }));
    expect(deps.findClubsByName).toHaveBeenCalledWith("Williamstown");
  });

  it("returns not found rather than guessing when no club matches", async () => {
    const deps = makeDeps({ findClubsByName: vi.fn().mockResolvedValue(ok([])) });

    const result = await resolveClub(deps, "Nonexistent FC");

    expect(result).toEqual(notFound('No club matches "Nonexistent FC"'));
  });

  it("fails listing every candidate rather than guessing when more than one club matches", async () => {
    const deps = makeDeps({
      findClubsByName: vi.fn().mockResolvedValue(
        ok([
          { id: "clb_williams0001", name: "Williamstown SC" },
          { id: "clb_williams0002", name: "Williamstown Juniors" },
        ]),
      ),
    });

    const result = await resolveClub(deps, "Williams");

    expect(result).toEqual(
      badRequest(
        '"Williams" matches more than one club — candidates: Williamstown SC (clb_williams0001), ' +
          "Williamstown Juniors (clb_williams0002)",
      ),
    );
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to find clubs by name");
    const deps = makeDeps({ findClubsByName: vi.fn().mockResolvedValue(lookupError) });

    const result = await resolveClub(deps, "Williamstown");

    expect(result).toEqual(lookupError);
  });

  it("errors when the matched club row id doesn't have the club prefix", async () => {
    const deps = makeDeps({
      findClubsByName: vi.fn().mockResolvedValue(ok([{ id: "cli_wrong0000", name: "Wrong" }])),
    });

    const result = await resolveClub(deps, "Wrong");

    expect(result.ok).toBe(false);
  });
});
