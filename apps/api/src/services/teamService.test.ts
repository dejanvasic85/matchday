import { notFound, ok, serverError } from "@matchday/domain";
import {
  getTeam,
  listAllTeams,
  listLeagueTeams,
  type TeamServiceDeps,
} from "#services/teamService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "clb_abc123",
    name: "Test FC",
    displayName: "Test FC",
    logoUrl: "https://example.com/logo.png",
    email: null,
    website: null,
    address: null,
    socials: null,
    grounds: null,
    color: null,
    accent: null,
    store: null,
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
    club: makeClubRow(),
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<TeamServiceDeps> = {}): TeamServiceDeps {
  return {
    listTeams: vi.fn().mockResolvedValue(ok([makeTeamRow()])),
    getTeamById: vi.fn().mockResolvedValue(ok(makeTeamRow())),
    listTeamsByLeagueId: vi.fn().mockResolvedValue(ok([makeTeamRow()])),
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

  it("marks a team with a club as type 'club', embedding a lean summary", async () => {
    const deps = makeDeps();

    const result = await listAllTeams(deps);

    expect(result).toEqual(
      ok([
        expect.objectContaining({
          type: "club",
          club: {
            id: "clb_abc123",
            name: "Test FC",
            displayName: "Test FC",
            logoUrl: "https://example.com/logo.png",
          },
        }),
      ]),
    );
  });

  it("marks a team with no club as type 'unaffiliated', omitting club entirely", async () => {
    const deps = makeDeps({
      listTeams: vi.fn().mockResolvedValue(ok([makeTeamRow({ clubId: null, club: null })])),
    });

    const result = await listAllTeams(deps);

    expect(result).toEqual(
      ok([expect.objectContaining({ id: "tea_abc123", type: "unaffiliated" })]),
    );
    assert(result.ok);
    expect(result.value[0]).not.toHaveProperty("club");
  });

  it("passes the clubId filter through to data access", async () => {
    const deps = makeDeps();

    await listAllTeams(deps, "clb_abc123");

    expect(deps.listTeams).toHaveBeenCalledWith("clb_abc123");
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list teams");
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

  it("returns a NotFound failure when the team doesn't exist", async () => {
    const deps = makeDeps({ getTeamById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getTeam(deps, "tea_missing0000");

    expect(result).toEqual(notFound("Team not found"));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to get team by id");
    const deps = makeDeps({ getTeamById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getTeam(deps, "tea_abc123");

    expect(result).toEqual(lookupError);
  });
});

describe("listLeagueTeams", () => {
  it("maps each team in the league, including its club summary", async () => {
    const deps = makeDeps();

    const result = await listLeagueTeams(deps, "lea_abc123");

    expect(result).toEqual(
      ok([
        expect.objectContaining({
          id: "tea_abc123",
          type: "club",
          club: expect.objectContaining({ id: "clb_abc123" }),
        }),
      ]),
    );
    expect(deps.listTeamsByLeagueId).toHaveBeenCalledWith("lea_abc123");
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to list teams by league id");
    const deps = makeDeps({ listTeamsByLeagueId: vi.fn().mockResolvedValue(lookupError) });

    const result = await listLeagueTeams(deps, "lea_abc123");

    expect(result).toEqual(lookupError);
  });
});
