import { notFound, ok, serverError } from "@matchday/domain";
import {
  getLeagueOverview,
  type LeagueOverviewServiceDeps,
} from "#services/leagueOverviewService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeLeagueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lea_abc123",
    name: "Division 1",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    competition: { id: "cmp_abc123", name: "Metro League", createdAt: epoch, updatedAt: epoch },
    season: { id: "sea_abc123", name: "2026", createdAt: epoch, updatedAt: epoch },
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeFixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mtc_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    round: 1,
    homeTeamId: "tea_abc123",
    awayTeamId: "tea_def456",
    venue: "Test Reserve",
    latitude: null,
    longitude: null,
    kickoffAt: epoch,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    isBye: false,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeTableEntryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tab_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    teamId: "tea_abc123",
    position: 1,
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    goalsFor: 3,
    goalsAgainst: 0,
    goalDifference: 3,
    points: 3,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeTeamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tea_abc123",
    clubId: "clb_abc123",
    name: "Test FC U12",
    club: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<LeagueOverviewServiceDeps> = {}): LeagueOverviewServiceDeps {
  return {
    getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
    listFixturesByLeagueId: vi.fn().mockResolvedValue(ok([makeFixtureRow()])),
    listTableEntriesByLeagueId: vi.fn().mockResolvedValue(ok([makeTableEntryRow()])),
    listTeamsByLeagueId: vi.fn().mockResolvedValue(ok([makeTeamRow()])),
    ...overrides,
  };
}

describe("getLeagueOverview", () => {
  it("returns the league with its fixtures, table and teams", async () => {
    const deps = makeDeps();

    const result = await getLeagueOverview(deps, "lea_abc123");

    expect(result).toEqual(
      ok(
        expect.objectContaining({
          id: "lea_abc123",
          competition: { id: "cmp_abc123", name: "Metro League" },
          fixtures: [expect.objectContaining({ id: "mtc_abc123" })],
          table: [expect.objectContaining({ id: "tab_abc123" })],
          teams: [expect.objectContaining({ id: "tea_abc123" })],
        }),
      ),
    );
  });

  it("returns empty collections rather than omitting them when the league has none", async () => {
    const deps = makeDeps({
      listFixturesByLeagueId: vi.fn().mockResolvedValue(ok([])),
      listTableEntriesByLeagueId: vi.fn().mockResolvedValue(ok([])),
      listTeamsByLeagueId: vi.fn().mockResolvedValue(ok([])),
    });

    const result = await getLeagueOverview(deps, "lea_abc123");

    expect(result).toEqual(ok(expect.objectContaining({ fixtures: [], table: [], teams: [] })));
  });

  it("reads all four collections concurrently", async () => {
    // Every read starts before any finishes. Sequential awaits would interleave start/end pairs,
    // so asserting call order alone would pass either way.
    const events: string[] = [];
    const track =
      <T>(name: string, value: T) =>
      () => {
        events.push(`${name}:start`);
        return new Promise((resolve) =>
          setTimeout(() => {
            events.push(`${name}:end`);
            resolve(value);
          }, 0),
        );
      };
    const deps = makeDeps({
      getLeagueById: vi.fn().mockImplementation(track("league", ok(makeLeagueRow()))),
      listFixturesByLeagueId: vi.fn().mockImplementation(track("fixtures", ok([]))),
      listTableEntriesByLeagueId: vi.fn().mockImplementation(track("table", ok([]))),
      listTeamsByLeagueId: vi.fn().mockImplementation(track("teams", ok([]))),
    });

    await getLeagueOverview(deps, "lea_abc123");

    expect(events.slice(0, 4)).toEqual([
      "league:start",
      "fixtures:start",
      "table:start",
      "teams:start",
    ]);
  });

  it("returns a NotFound failure when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getLeagueOverview(deps, "lea_missing0000");

    expect(result).toEqual(notFound("League not found"));
  });

  it("propagates a fixtures failure", async () => {
    const listError = serverError("Failed to list fixtures");
    const deps = makeDeps({ listFixturesByLeagueId: vi.fn().mockResolvedValue(listError) });

    const result = await getLeagueOverview(deps, "lea_abc123");

    expect(result).toEqual(listError);
  });

  it("propagates a table failure", async () => {
    const listError = serverError("Failed to list table entries");
    const deps = makeDeps({ listTableEntriesByLeagueId: vi.fn().mockResolvedValue(listError) });

    const result = await getLeagueOverview(deps, "lea_abc123");

    expect(result).toEqual(listError);
  });

  it("propagates a teams failure", async () => {
    const listError = serverError("Failed to list teams");
    const deps = makeDeps({ listTeamsByLeagueId: vi.fn().mockResolvedValue(listError) });

    const result = await getLeagueOverview(deps, "lea_abc123");

    expect(result).toEqual(listError);
  });
});
