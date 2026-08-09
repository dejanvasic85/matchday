import { err, ok } from "@matchday/domain";
import { getLeague, listAllLeagues, type LeagueServiceDeps } from "./leagueService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeLeagueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lea_abc123",
    name: "Division 1",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<LeagueServiceDeps> = {}): LeagueServiceDeps {
  return {
    listLeagues: vi.fn().mockResolvedValue(ok([makeLeagueRow()])),
    getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
    ...overrides,
  };
}

describe("listAllLeagues", () => {
  it("maps each league's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllLeagues(deps);

    expect(result).toEqual(
      ok([expect.objectContaining({ id: "lea_abc123", createdAt: epoch.toISOString() })]),
    );
  });

  it("passes the competitionId/seasonId filter through to data access", async () => {
    const deps = makeDeps();
    const filter = { competitionId: "cmp_abc123", seasonId: "sea_abc123" };

    await listAllLeagues(deps, filter);

    expect(deps.listLeagues).toHaveBeenCalledWith(filter);
  });

  it("propagates a list failure", async () => {
    const listError = err({ message: "Failed to list leagues" });
    const deps = makeDeps({ listLeagues: vi.fn().mockResolvedValue(listError) });

    const result = await listAllLeagues(deps);

    expect(result).toEqual(listError);
  });
});

describe("getLeague", () => {
  it("maps a found league's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await getLeague(deps, "lea_abc123");

    expect(result).toEqual(
      ok(expect.objectContaining({ id: "lea_abc123", updatedAt: epoch.toISOString() })),
    );
  });

  it("returns null when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getLeague(deps, "lea_missing0000");

    expect(result).toEqual(ok(null));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = err({ message: "Failed to get league by id" });
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getLeague(deps, "lea_abc123");

    expect(result).toEqual(lookupError);
  });
});
