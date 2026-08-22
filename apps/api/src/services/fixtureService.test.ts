import { ok, serverError } from "@matchday/domain";
import { listLeagueFixtures, type FixtureServiceDeps } from "#services/fixtureService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");
const kickoffAt = new Date("2026-03-14T10:00:00.000Z");

function makeFixtureRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "mtc_abc123",
    leagueId: "lea_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    round: 3,
    homeTeamId: "tea_home0001",
    awayTeamId: "tea_away0001",
    venue: "Home Ground",
    latitude: "-37.812200",
    longitude: "144.960000",
    kickoffAt,
    status: "scheduled",
    homeScore: null,
    awayScore: null,
    isBye: false,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<FixtureServiceDeps> = {}): FixtureServiceDeps {
  return {
    listFixturesByLeagueId: vi.fn().mockResolvedValue(ok([makeFixtureRow()])),
    ...overrides,
  };
}

describe("listLeagueFixtures", () => {
  it("maps timestamps to ISO strings and numeric lat/long to numbers", async () => {
    const deps = makeDeps();

    const result = await listLeagueFixtures(deps, "lea_abc123");

    expect(result).toEqual(
      ok([
        expect.objectContaining({
          id: "mtc_abc123",
          latitude: -37.8122,
          longitude: 144.96,
          kickoffAt: kickoffAt.toISOString(),
          createdAt: epoch.toISOString(),
        }),
      ]),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listFixturesByLeagueId: vi
        .fn()
        .mockResolvedValue(ok([makeFixtureRow({ internalNotes: "secret" })])),
    });

    const result = await listLeagueFixtures(deps, "lea_abc123");

    expect(result).toEqual(ok([expect.not.objectContaining({ internalNotes: expect.anything() })]));
  });

  it("maps a null kickoffAt/lat/long through as null", async () => {
    const deps = makeDeps({
      listFixturesByLeagueId: vi
        .fn()
        .mockResolvedValue(
          ok([makeFixtureRow({ kickoffAt: null, latitude: null, longitude: null })]),
        ),
    });

    const result = await listLeagueFixtures(deps, "lea_abc123");

    expect(result).toEqual(
      ok([expect.objectContaining({ kickoffAt: null, latitude: null, longitude: null })]),
    );
  });

  it("passes the leagueId through to data access", async () => {
    const deps = makeDeps();

    await listLeagueFixtures(deps, "lea_abc123");

    expect(deps.listFixturesByLeagueId).toHaveBeenCalledWith("lea_abc123");
  });

  it("propagates a fixture list failure", async () => {
    const listError = serverError("Failed to list fixtures by league id");
    const deps = makeDeps({ listFixturesByLeagueId: vi.fn().mockResolvedValue(listError) });

    const result = await listLeagueFixtures(deps, "lea_abc123");

    expect(result).toEqual(listError);
  });
});
