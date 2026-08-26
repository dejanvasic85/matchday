import { notFound, ok, serverError } from "@matchday/domain";
import {
  getCompetition,
  listAllCompetitions,
  type CompetitionServiceDeps,
} from "#services/competitionService.ts";

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

function makeDeps(overrides: Partial<CompetitionServiceDeps> = {}): CompetitionServiceDeps {
  return {
    listCompetitions: vi
      .fn()
      .mockResolvedValue(ok({ rows: [makeCompetitionRow()], nextCursor: null })),
    getCompetitionById: vi.fn().mockResolvedValue(ok(makeCompetitionRow())),
    ...overrides,
  };
}

describe("listAllCompetitions", () => {
  it("maps each competition's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllCompetitions(deps);

    expect(result).toEqual(
      ok({
        data: [expect.objectContaining({ id: "cmp_abc123", createdAt: epoch.toISOString() })],
        nextCursor: null,
      }),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listCompetitions: vi
        .fn()
        .mockResolvedValue(ok([makeCompetitionRow({ internalNotes: "secret" })])),
    });

    const result = await listAllCompetitions(deps);

    expect(result).toEqual(ok([expect.not.objectContaining({ internalNotes: expect.anything() })]));
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list competitions");
    const deps = makeDeps({ listCompetitions: vi.fn().mockResolvedValue(listError) });

    const result = await listAllCompetitions(deps);

    expect(result).toEqual(listError);
  });
});

describe("getCompetition", () => {
  it("maps a found competition's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await getCompetition(deps, "cmp_abc123");

    expect(result).toEqual(
      ok(expect.objectContaining({ id: "cmp_abc123", updatedAt: epoch.toISOString() })),
    );
  });

  it("returns a NotFound failure when the competition doesn't exist", async () => {
    const deps = makeDeps({ getCompetitionById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getCompetition(deps, "cmp_missing0000");

    expect(result).toEqual(notFound("Competition not found"));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to get competition by id");
    const deps = makeDeps({ getCompetitionById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getCompetition(deps, "cmp_abc123");

    expect(result).toEqual(lookupError);
  });
});
