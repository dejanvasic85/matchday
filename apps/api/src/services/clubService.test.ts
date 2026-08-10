import { err, ok } from "@matchday/domain";
import { getClub, listAllClubs, type ClubServiceDeps } from "./clubService.ts";

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

  it("propagates a list failure", async () => {
    const listError = err({ message: "Failed to list clubs" });
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

  it("returns null when the club doesn't exist", async () => {
    const deps = makeDeps({ getClubById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await getClub(deps, "clb_missing0000");

    expect(result).toEqual(ok(null));
  });

  it("propagates a lookup failure", async () => {
    const lookupError = err({ message: "Failed to get club by id" });
    const deps = makeDeps({ getClubById: vi.fn().mockResolvedValue(lookupError) });

    const result = await getClub(deps, "clb_abc123");

    expect(result).toEqual(lookupError);
  });
});
