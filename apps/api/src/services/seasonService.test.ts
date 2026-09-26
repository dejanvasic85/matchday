import { createDbClient, listSeasons } from "@matchday/db";
import { notFound, ok, serverError } from "@matchday/domain";
import {
  createSeasonServiceDeps,
  getSeason,
  listAllSeasons,
  type SeasonServiceDeps,
} from "#services/seasonService.ts";

vi.mock("@matchday/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@matchday/db")>()),
  listSeasons: vi.fn(),
}));

// Never queried: the data-access function it would reach is mocked above.
const db = createDbClient("postgres://user:pass@localhost:5432/db");

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeSeasonRow(overrides: Record<string, unknown> = {}) {
  return { id: "sea_abc123", name: "2026", createdAt: epoch, updatedAt: epoch, ...overrides };
}

function makeDeps(overrides: Partial<SeasonServiceDeps> = {}): SeasonServiceDeps {
  return {
    listSeasons: vi.fn().mockResolvedValue(ok({ rows: [makeSeasonRow()], nextCursor: null })),
    getSeasonById: vi.fn().mockResolvedValue(ok(makeSeasonRow())),
    ...overrides,
  };
}

describe("listAllSeasons", () => {
  it("maps each season's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllSeasons(deps);

    expect(result).toEqual(
      ok({
        data: [expect.objectContaining({ id: "sea_abc123", createdAt: epoch.toISOString() })],
        nextCursor: null,
      }),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listSeasons: vi
        .fn()
        .mockResolvedValue(
          ok({ rows: [makeSeasonRow({ internalNotes: "secret" })], nextCursor: null }),
        ),
    });

    const result = await listAllSeasons(deps);

    expect(result).toEqual(
      ok({
        data: [expect.not.objectContaining({ internalNotes: expect.anything() })],
        nextCursor: null,
      }),
    );
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list seasons");
    const deps = makeDeps({ listSeasons: vi.fn().mockResolvedValue(listError) });

    const result = await listAllSeasons(deps);

    expect(result).toEqual(listError);
  });
});

describe("createSeasonServiceDeps", () => {
  it("forwards the page to the real listSeasons", async () => {
    const page = { limit: 25, cursor: "c2VhX2FiYzEyMw" };

    await createSeasonServiceDeps(db).listSeasons({}, page);

    expect(vi.mocked(listSeasons)).toHaveBeenCalledWith(db, {}, page);
  });
});

describe("getSeason", () => {
  it("maps a found season's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await getSeason(deps, "sea_abc123");

    expect(result).toEqual(
      ok(expect.objectContaining({ id: "sea_abc123", updatedAt: epoch.toISOString() })),
    );
  });

  it("returns a NotFound failure when the season doesn't exist", async () => {
    const deps = makeDeps({ getSeasonById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getSeason(deps, "sea_missing0000");

    expect(result).toEqual(notFound("Season not found"));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to get season by id");
    const deps = makeDeps({ getSeasonById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getSeason(deps, "sea_abc123");

    expect(result).toEqual(lookupError);
  });
});
