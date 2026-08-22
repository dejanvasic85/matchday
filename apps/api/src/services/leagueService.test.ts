import { notFound, ok, serverError } from "@matchday/domain";
import { getLeague, listAllLeagues, type LeagueServiceDeps } from "#services/leagueService.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeCompetitionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmp_abc123",
    name: "Metro League",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeSeasonRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sea_abc123",
    name: "2026",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeLeagueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lea_abc123",
    name: "Division 1",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    competition: makeCompetitionRow(),
    season: makeSeasonRow(),
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<LeagueServiceDeps> = {}): LeagueServiceDeps {
  return {
    listLeagues: vi.fn().mockResolvedValue(ok({ rows: [makeLeagueRow()], nextCursor: null })),
    getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
    ...overrides,
  };
}

describe("listAllLeagues", () => {
  it("maps each league's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllLeagues(deps);

    expect(result).toEqual(
      ok({
        data: [expect.objectContaining({ id: "lea_abc123", createdAt: epoch.toISOString() })],
        nextCursor: null,
      }),
    );
  });

  it("embeds each league's competition and season as id/name summaries", async () => {
    const deps = makeDeps();

    const result = await listAllLeagues(deps);

    expect(result).toEqual(
      ok({
        data: [
          expect.objectContaining({
            competition: { id: "cmp_abc123", name: "Metro League" },
            season: { id: "sea_abc123", name: "2026" },
          }),
        ],
        nextCursor: null,
      }),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listLeagues: vi
        .fn()
        .mockResolvedValue(
          ok({ rows: [makeLeagueRow({ internalNotes: "secret" })], nextCursor: null }),
        ),
    });

    const result = await listAllLeagues(deps);

    expect(result).toEqual(
      ok({
        data: [expect.not.objectContaining({ internalNotes: expect.anything() })],
        nextCursor: null,
      }),
    );
  });

  it("passes the competitionId/seasonId/clubId filter through to data access", async () => {
    const deps = makeDeps();
    const filter = { competitionId: "cmp_abc123", seasonId: "sea_abc123", clubId: "clb_abc123" };

    await listAllLeagues(deps, filter);

    expect(deps.listLeagues).toHaveBeenCalledWith(filter, undefined);
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list leagues");
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

  it("trims the embedded competition/season to id and name, dropping their timestamps", async () => {
    const deps = makeDeps();

    const result = await getLeague(deps, "lea_abc123");

    expect(result).toEqual(
      ok(
        expect.objectContaining({
          competition: { id: "cmp_abc123", name: "Metro League" },
          season: { id: "sea_abc123", name: "2026" },
        }),
      ),
    );
  });

  it("returns a NotFound failure when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getLeague(deps, "lea_missing0000");

    expect(result).toEqual(notFound("League not found"));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to get league by id");
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getLeague(deps, "lea_abc123");

    expect(result).toEqual(lookupError);
  });
});
