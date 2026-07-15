import { err, ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "@/test/fixtures/logger.ts";
import { makeQueuedFakePage } from "@/test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "@/test/fixtures/rawStorage.ts";
import { buildRawClubsKey, runClubsSync, type ClubsSyncDeps } from "./clubsSync.ts";

const tenantResponseValue = { data: { id: "tenant_hash_01" } };

function makeDriblClub(overrides: { id?: string; name?: string; image?: string | null } = {}) {
  return {
    type: "clubs" as const,
    id: overrides.id ?? "dribl_club_1",
    attributes: {
      name: overrides.name ?? "Altona North SC",
      image: overrides.image ?? "https://ocean.dribl.com/logo.png",
      email: null,
      url: null,
      address: null,
      socials: null,
    },
  };
}

function makeClubsResponse(clubs: ReturnType<typeof makeDriblClub>[]) {
  return { data: clubs };
}

function makeExternalRefRow(internalId: string) {
  return {
    id: "ext_existing0001",
    entityType: "club",
    internalId,
    source: "dribl",
    sourceId: "dribl_club_1",
    sourceUrl: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function makeClubRow(id: string) {
  return {
    id,
    name: "Altona North SC",
    displayName: "Altona North SC",
    logoUrl: "https://ocean.dribl.com/logo.png",
    email: null,
    website: null,
    address: null,
    socials: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function makeDeps(
  overrides: Partial<Pick<ClubsSyncDeps, "page" | "rawStorage" | "resolution">> = {},
): ClubsSyncDeps {
  const rawStorage = makeFakeRawStorage();
  return {
    page: makeQueuedFakePage([tenantResponseValue, makeClubsResponse([makeDriblClub()])]),
    rawStorage,
    resolution: makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow("clb_new00000001"))),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow("clb_new00000001"))),
    }),
    logger: makeFakeLogger(),
    tenantSlug: "fv",
    driblSiteHost: "fv.dribl.com",
    crawlRunId: "2026-07-15T00-00-00.000Z",
    ...overrides,
  };
}

describe("runClubsSync", () => {
  it("creates a new club and external_ref when no ref exists yet", async () => {
    const deps = makeDeps();

    const result = await runClubsSync(deps);

    expect(result).toEqual(ok({ total: 1, synced: 1, failed: 0 }));
    expect(deps.resolution.upsertClub).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^clb_/), name: "Altona North SC" }),
    );
    expect(deps.resolution.upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "club",
        source: "dribl",
        sourceId: "dribl_club_1",
        internalId: "clb_new00000001",
      }),
    );
  });

  it("reuses the existing internal id when an external_ref is already mapped", async () => {
    const deps = makeDeps({
      resolution: makeFakeEntityResolutionDeps({
        findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow("clb_existing0001"))),
        upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow("clb_existing0001"))),
        upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow("clb_existing0001"))),
      }),
    });

    const result = await runClubsSync(deps);

    expect(result).toEqual(ok({ total: 1, synced: 1, failed: 0 }));
    expect(deps.resolution.upsertClub).toHaveBeenCalledWith(
      expect.objectContaining({ id: "clb_existing0001" }),
    );
  });

  it("attaches to a logo-matched club (created via club_code) instead of duplicating", async () => {
    const upsertClub = vi.fn().mockResolvedValue(ok(makeClubRow("clb_bycode00001")));
    const deps = makeDeps({
      resolution: makeFakeEntityResolutionDeps({
        findExternalRef: vi.fn().mockResolvedValue(ok(null)),
        findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow("clb_bycode00001"))),
        upsertClub,
        upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow("clb_bycode00001"))),
      }),
    });

    const result = await runClubsSync(deps);

    expect(result).toEqual(ok({ total: 1, synced: 1, failed: 0 }));
    // enriches the existing club row rather than generating a fresh id
    expect(upsertClub).toHaveBeenCalledWith(expect.objectContaining({ id: "clb_bycode00001" }));
    expect(deps.resolution.upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({ source: "dribl", internalId: "clb_bycode00001" }),
    );
  });

  it("stages the raw clubs response to R2 under the run's key", async () => {
    const rawStorage = makeFakeRawStorage();
    const deps = makeDeps({ rawStorage });

    await runClubsSync(deps);

    expect(rawStorage.puts).toHaveLength(1);
    expect(rawStorage.puts[0]?.key).toBe(buildRawClubsKey("2026-07-15T00-00-00.000Z"));
  });

  it("counts a per-club failure without aborting the whole run", async () => {
    const deps = makeDeps({
      page: makeQueuedFakePage([
        tenantResponseValue,
        makeClubsResponse([
          makeDriblClub({ id: "dribl_club_1", name: "Club One" }),
          makeDriblClub({ id: "dribl_club_2", name: "Club Two" }),
        ]),
      ]),
      resolution: makeFakeEntityResolutionDeps({
        findExternalRef: vi.fn().mockResolvedValue(ok(null)),
        findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
        upsertClub: vi
          .fn()
          .mockResolvedValueOnce(err({ message: "db down" }))
          .mockResolvedValueOnce(ok(makeClubRow("clb_new00000002"))),
        upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow("clb_new00000002"))),
      }),
    });

    const result = await runClubsSync(deps);

    expect(result).toEqual(ok({ total: 2, synced: 1, failed: 1 }));
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("fails the run when the tenant response is invalid", async () => {
    const deps = makeDeps({
      page: makeQueuedFakePage([{ data: {} }, makeClubsResponse([makeDriblClub()])]),
    });

    const result = await runClubsSync(deps);

    expect(result.ok).toBe(false);
  });

  it("fails the run when the clubs response fails validation", async () => {
    const deps = makeDeps({
      page: makeQueuedFakePage([tenantResponseValue, { data: [{ bogus: true }] }]),
    });

    const result = await runClubsSync(deps);

    expect(result.ok).toBe(false);
  });

  it("propagates an R2 staging failure", async () => {
    const rawStorage = makeFakeRawStorage();
    rawStorage.putJson = vi.fn().mockResolvedValue(err({ message: "R2 down" }));
    const deps = makeDeps({ rawStorage });

    const result = await runClubsSync(deps);

    expect(result).toEqual(err({ message: "R2 down" }));
  });
});
