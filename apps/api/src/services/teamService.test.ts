import { err, ok } from "@matchday/domain";
import { getTeam, listAllTeams, type TeamServiceDeps } from "./teamService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tea_abc123",
    clubId: "clb_abc123",
    name: "Test FC U12",
    ageGroup: "U12",
    gender: "mixed",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<TeamServiceDeps> = {}): TeamServiceDeps {
  return {
    listTeams: vi.fn().mockResolvedValue(ok([makeTeamRow()])),
    getTeamById: vi.fn().mockResolvedValue(ok(makeTeamRow())),
    ...overrides,
  };
}

describe("listAllTeams", () => {
  it("maps each team's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllTeams(deps);

    expect(result).toEqual(
      ok([expect.objectContaining({ id: "tea_abc123", createdAt: epoch.toISOString() })]),
    );
  });

  it("passes the clubId filter through to data access", async () => {
    const deps = makeDeps();

    await listAllTeams(deps, "clb_abc123");

    expect(deps.listTeams).toHaveBeenCalledWith("clb_abc123");
  });

  it("propagates a list failure", async () => {
    const listError = err({ message: "Failed to list teams" });
    const deps = makeDeps({ listTeams: vi.fn().mockResolvedValue(listError) });

    const result = await listAllTeams(deps);

    expect(result).toEqual(listError);
  });
});

describe("getTeam", () => {
  it("maps a found team's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await getTeam(deps, "tea_abc123");

    expect(result).toEqual(
      ok(expect.objectContaining({ id: "tea_abc123", updatedAt: epoch.toISOString() })),
    );
  });

  it("returns null when the team doesn't exist", async () => {
    const deps = makeDeps({ getTeamById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getTeam(deps, "tea_missing0000");

    expect(result).toEqual(ok(null));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = err({ message: "Failed to get team by id" });
    const deps = makeDeps({ getTeamById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getTeam(deps, "tea_abc123");

    expect(result).toEqual(lookupError);
  });
});
