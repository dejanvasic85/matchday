import { ok, type Result } from "@matchday/domain";
import type { MappedClubDetail } from "#crawlers/dribl/mappers/mapDriblClubDetail.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { persistClubEnrichment } from "#crawlers/dribl/clubEnrichmentPersistence.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(
  overrides: Partial<{
    logoUrl: string | null;
    email: string | null;
    address: string | null;
    color: string | null;
  }> = {},
) {
  return {
    id: "clb_existing0001",
    name: "Aintree SC",
    displayName: "Aintree SC",
    logoUrl: "https://assets.matchday.dev/logos/clb_existing0001-oldhash.png",
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

function makeMappedClub(overrides: Partial<MappedClubDetail> = {}): MappedClubDetail {
  return {
    sourceId: "3vmZv3YLmq",
    name: "Aintree SC",
    displayName: "Aintree SC",
    logoUrl: "https://ocean.dribl.com/logo",
    email: "aintreesc@gmail.com",
    website: null,
    address: "2 Recreation Rd, Aintree VIC 3336",
    socials: null,
    grounds: { name: "Aintree North Recreation Reserve", address: "2 Recreation Rd" },
    color: "#F15828",
    accent: "#FFFFFF",
    store: "/club/9294",
    ...overrides,
  };
}

function makeFakeAssetStorage() {
  return {
    putObject: vi.fn<() => Promise<Result<void>>>().mockResolvedValue(ok(undefined)),
  };
}

const downloadImage = vi
  .fn()
  .mockResolvedValue(ok({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" }));

describe("persistClubEnrichment", () => {
  it("resolves, mirrors the logo, and updates enrichment fields for a matched club", async () => {
    const updateClubEnrichmentFields = vi.fn().mockResolvedValue(ok(makeClubRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(
        ok({
          id: "ext_1",
          entityType: "club",
          internalId: "clb_existing0001",
          source: "dribl",
          sourceId: "3vmZv3YLmq",
          sourceUrl: null,
          createdAt: epoch,
          updatedAt: epoch,
        }),
      ),
      getClubById: vi.fn().mockResolvedValue(ok(makeClubRow())),
      updateClubEnrichmentFields,
    });

    const result = await persistClubEnrichment({
      deps,
      assetStorage: makeFakeAssetStorage(),
      downloadImage,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
      logger: makeFakeLogger(),
      club: makeMappedClub(),
    });

    expect(result).toEqual({ ok: true, value: "updated" });
    expect(updateClubEnrichmentFields).toHaveBeenCalledWith(
      "clb_existing0001",
      expect.objectContaining({
        email: "aintreesc@gmail.com",
        grounds: { name: "Aintree North Recreation Reserve", address: "2 Recreation Rd" },
        color: "#F15828",
        store: "/club/9294",
      }),
    );
  });

  it("keeps the existing value for a field this run's clubs/{id} response came back null for", async () => {
    const updateClubEnrichmentFields = vi.fn().mockResolvedValue(ok(makeClubRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(
        ok({
          id: "ext_1",
          entityType: "club",
          internalId: "clb_existing0001",
          source: "dribl",
          sourceId: "3vmZv3YLmq",
          sourceUrl: null,
          createdAt: epoch,
          updatedAt: epoch,
        }),
      ),
      getClubById: vi
        .fn()
        .mockResolvedValue(
          ok(makeClubRow({ email: "old@example.com", address: "old address", color: "#000000" })),
        ),
      updateClubEnrichmentFields,
    });

    await persistClubEnrichment({
      deps,
      assetStorage: makeFakeAssetStorage(),
      downloadImage,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
      logger: makeFakeLogger(),
      club: makeMappedClub({ email: null, address: null, color: null }),
    });

    expect(updateClubEnrichmentFields).toHaveBeenCalledWith(
      "clb_existing0001",
      expect.objectContaining({
        email: "old@example.com",
        address: "old address",
        color: "#000000",
      }),
    );
  });

  it("skips an unmatched club (admin pseudo-club) without writing anything", async () => {
    const updateClubEnrichmentFields = vi.fn();
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
      updateClubEnrichmentFields,
    });
    const logger = makeFakeLogger();

    const result = await persistClubEnrichment({
      deps,
      assetStorage: makeFakeAssetStorage(),
      downloadImage,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
      logger,
      club: makeMappedClub({ name: "FV Albury Wodonga Referees" }),
    });

    expect(result).toEqual({ ok: true, value: "skipped" });
    expect(updateClubEnrichmentFields).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it("logs a warning and returns skipped when updateClubEnrichmentFields finds no row (race)", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(
        ok({
          id: "ext_1",
          entityType: "club",
          internalId: "clb_existing0001",
          source: "dribl",
          sourceId: "3vmZv3YLmq",
          sourceUrl: null,
          createdAt: epoch,
          updatedAt: epoch,
        }),
      ),
      getClubById: vi.fn().mockResolvedValue(ok(makeClubRow())),
      updateClubEnrichmentFields: vi.fn().mockResolvedValue(ok(null)),
    });
    const logger = makeFakeLogger();

    const result = await persistClubEnrichment({
      deps,
      assetStorage: makeFakeAssetStorage(),
      downloadImage,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
      logger,
      club: makeMappedClub(),
    });

    expect(result).toEqual({ ok: true, value: "skipped" });
    expect(logger.warn).toHaveBeenCalled();
  });

  it("propagates a resolveClubForEnrichment failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await persistClubEnrichment({
      deps,
      assetStorage: makeFakeAssetStorage(),
      downloadImage,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
      logger: makeFakeLogger(),
      club: makeMappedClub(),
    });

    assert(!result.ok);
  });
});
