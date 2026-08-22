import { notFound, ok, serverError } from "@matchday/domain";
import { getClub, listAllClubs, type ClubServiceDeps } from "#services/clubService.ts";

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
    listClubs: vi.fn().mockResolvedValue(ok([makeClubRow()])),
    getClubById: vi.fn().mockResolvedValue(ok(makeClubRow())),
    ...overrides,
  };
}

describe("listAllClubs", () => {
  it("maps each club's timestamps to ISO strings", async () => {
    const deps = makeDeps();

    const result = await listAllClubs(deps);

    expect(result).toEqual(
      ok([expect.objectContaining({ id: "clb_abc123", createdAt: epoch.toISOString() })]),
    );
  });

  it("keeps a column the response doesn't name off the wire", async () => {
    const deps = makeDeps({
      listClubs: vi.fn().mockResolvedValue(ok([makeClubRow({ internalNotes: "secret" })])),
    });

    const result = await listAllClubs(deps);

    expect(result).toEqual(ok([expect.not.objectContaining({ internalNotes: expect.anything() })]));
  });

  it("propagates a list failure", async () => {
    const listError = serverError("Failed to list clubs");
    const deps = makeDeps({ listClubs: vi.fn().mockResolvedValue(listError) });

    const result = await listAllClubs(deps);

    expect(result).toEqual(listError);
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
