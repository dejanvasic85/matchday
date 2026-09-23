import { createDbClient, listClubs } from "@matchday/db";
import { notFound, ok, serverError } from "@matchday/domain";
import {
  createClubServiceDeps,
  getClub,
  listAllClubs,
  type ClubServiceDeps,
} from "#services/clubService.ts";

vi.mock("@matchday/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@matchday/db")>()),
  listClubs: vi.fn(),
}));

// Never queried: the data-access function it would reach is mocked above.
const db = createDbClient("postgres://user:pass@localhost:5432/db");

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "clb_abc123",
    name: "Test FC",
    displayName: "Test FC",
    logoUrl: null,
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

function makeDeps(overrides: Partial<ClubServiceDeps> = {}): ClubServiceDeps {
  return {
    listClubs: vi.fn().mockResolvedValue(ok({ rows: [makeClubRow()], nextCursor: null })),
    getClubById: vi.fn().mockResolvedValue(ok(makeClubRow())),
    ...overrides,
  };
}

describe("listAllClubs", () => {
  it("maps each club's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllClubs(deps);

    expect(result).toEqual(
      ok({
        data: [expect.objectContaining({ id: "clb_abc123", createdAt: epoch.toISOString() })],
        nextCursor: null,
      }),
    );
  });

  it("passes the name filter, limit and cursor through to data access", async () => {
    const deps = makeDeps();
    const filter = { name: "williamstown" };
    const page = { limit: 25, cursor: "Y2xiX2FiYzEyMw" };

    await listAllClubs(deps, filter, page);

    expect(deps.listClubs).toHaveBeenCalledWith(filter, page);
  });

  it("surfaces nextCursor so a caller knows another page exists", async () => {
    const deps = makeDeps({
      listClubs: vi
        .fn()
        .mockResolvedValue(ok({ rows: [makeClubRow()], nextCursor: "Y2xiX2FiYzEyMw" })),
    });

    const result = await listAllClubs(deps);

    expect(result).toEqual(
      ok({ data: [expect.objectContaining({ id: "clb_abc123" })], nextCursor: "Y2xiX2FiYzEyMw" }),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listClubs: vi
        .fn()
        .mockResolvedValue(
          ok({ rows: [makeClubRow({ internalNotes: "secret" })], nextCursor: null }),
        ),
    });

    const result = await listAllClubs(deps);

    expect(result).toEqual(
      ok({
        data: [expect.not.objectContaining({ internalNotes: expect.anything() })],
        nextCursor: null,
      }),
    );
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list clubs");
    const deps = makeDeps({ listClubs: vi.fn().mockResolvedValue(listError) });

    const result = await listAllClubs(deps);

    expect(result).toEqual(listError);
  });
});

describe("createClubServiceDeps", () => {
  it("forwards the name filter and page to the real listClubs", async () => {
    const filter = { name: "williamstown" };
    const page = { limit: 25, cursor: "Y2xiX2FiYzEyMw" };

    await createClubServiceDeps(db).listClubs(filter, page);

    expect(vi.mocked(listClubs)).toHaveBeenCalledWith(db, filter, page);
  });
});

describe("getClub", () => {
  it("maps a found club's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await getClub(deps, "clb_abc123");

    expect(result).toEqual(
      ok(expect.objectContaining({ id: "clb_abc123", updatedAt: epoch.toISOString() })),
    );
  });

  it("returns a NotFound failure when the club doesn't exist", async () => {
    const deps = makeDeps({ getClubById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getClub(deps, "clb_missing0000");

    expect(result).toEqual(notFound("Club not found"));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to get club by id");
    const deps = makeDeps({ getClubById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getClub(deps, "clb_abc123");

    expect(result).toEqual(lookupError);
  });
});
