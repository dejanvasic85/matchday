import { ok, serverError, type ExternalRef, type Result } from "@matchday/domain";
import type { CoastalClub } from "#crawlers/coastal/roster.ts";
import { persistCoastalClubEnrichment } from "#crawlers/coastal/clubEnrichmentPersistence.ts";
import type { EntityResolutionDeps } from "#crawlers/entityResolutionDeps.ts";
import type { DownloadedImage } from "#storage/clubLogoMirror.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");
const publicAssetsBaseUrl = "https://assets.matchday.dev";

const club: CoastalClub = {
  key: "harbourside",
  name: "Harbourside FC",
  teamName: "Harbourside FC",
  ground: "Harbourside Oval",
  strength: 1.28,
  color: "#0B4F9E",
  accent: "#F2C200",
};

function makeClubRow(overrides: Partial<{ logoUrl: string | null }> = {}) {
  return {
    id: "clb_existing0001",
    name: club.name,
    displayName: club.name,
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

function makeRefRow(internalId = "clb_existing0001"): ExternalRef {
  return {
    id: "ext_row0000001",
    entityType: "club",
    internalId,
    source: "coastal",
    sourceId: "club-harbourside",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function makeFakeAssetStorage() {
  const puts: Array<{ key: string; contentType: string }> = [];
  const putObject =
    vi.fn<(key: string, body: Uint8Array, contentType: string) => Promise<Result<void>>>();
  putObject.mockImplementation((key, _body, contentType) => {
    puts.push({ key, contentType });
    return Promise.resolve(ok(undefined));
  });
  return { puts, putObject };
}

const crestImage: DownloadedImage = {
  bytes: new TextEncoder().encode("<svg>crest</svg>"),
  contentType: "image/svg+xml",
};

function makeInput(
  overrides: {
    deps?: Partial<EntityResolutionDeps>;
    assetStorage?: ReturnType<typeof makeFakeAssetStorage>;
    loadLogo?: (club: CoastalClub) => Promise<Result<DownloadedImage>>;
  } = {},
) {
  const assetStorage = overrides.assetStorage ?? makeFakeAssetStorage();
  const deps = makeFakeEntityResolutionDeps({
    findExternalRef: vi.fn().mockResolvedValue(ok(makeRefRow())),
    getClubById: vi.fn().mockResolvedValue(ok(makeClubRow())),
    updateClubEnrichmentFields: vi.fn().mockResolvedValue(ok(makeClubRow())),
    ...overrides.deps,
  });
  return {
    input: {
      deps,
      assetStorage,
      loadLogo: overrides.loadLogo ?? vi.fn().mockResolvedValue(ok(crestImage)),
      publicAssetsBaseUrl,
      logger: makeFakeLogger(),
      club,
    },
    assetStorage,
    deps,
  };
}

describe("persistCoastalClubEnrichment", () => {
  it("mirrors the crest and writes the logo plus the club colours", async () => {
    const { input, assetStorage, deps } = makeInput();

    const result = await persistCoastalClubEnrichment(input);

    expect(result).toEqual(ok("updated"));
    expect(assetStorage.puts).toHaveLength(1);
    expect(assetStorage.puts[0]?.contentType).toBe("image/svg+xml");
    expect(deps.updateClubEnrichmentFields).toHaveBeenCalledWith(
      "clb_existing0001",
      expect.objectContaining({
        logoUrl: expect.stringMatching(
          /^https:\/\/assets\.matchday\.dev\/logos\/clb_existing0001-[0-9a-f]{8}\.svg$/,
        ),
        color: "#0B4F9E",
        accent: "#F2C200",
      }),
    );
  });

  it("keeps fields the crest does not own when writing", async () => {
    const existing = makeClubRow({ logoUrl: null });
    const { input, deps } = makeInput({
      deps: {
        getClubById: vi.fn().mockResolvedValue(ok({ ...existing, email: "keep@example.com" })),
      },
    });

    await persistCoastalClubEnrichment(input);

    expect(deps.updateClubEnrichmentFields).toHaveBeenCalledWith(
      "clb_existing0001",
      expect.objectContaining({ email: "keep@example.com" }),
    );
  });

  it("uploads nothing on a second run when the logo hash is unchanged", async () => {
    const first = makeInput();
    await persistCoastalClubEnrichment(first.input);
    const uploadedKey = first.assetStorage.puts[0]?.key ?? "";
    const currentLogoUrl = `${publicAssetsBaseUrl}/${uploadedKey}`;

    const second = makeInput({
      deps: {
        getClubById: vi.fn().mockResolvedValue(ok(makeClubRow({ logoUrl: currentLogoUrl }))),
      },
    });
    const result = await persistCoastalClubEnrichment(second.input);

    expect(result).toEqual(ok("updated"));
    expect(second.assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("skips without writing when the club has no coastal external ref", async () => {
    const { input, assetStorage, deps } = makeInput({
      deps: { findExternalRef: vi.fn().mockResolvedValue(ok(null)) },
    });

    const result = await persistCoastalClubEnrichment(input);

    expect(result).toEqual(ok("skipped"));
    expect(assetStorage.putObject).not.toHaveBeenCalled();
    expect(deps.updateClubEnrichmentFields).not.toHaveBeenCalled();
  });

  it("skips without writing when the club row is missing", async () => {
    const { input, assetStorage } = makeInput({
      deps: { getClubById: vi.fn().mockResolvedValue(ok(null)) },
    });

    const result = await persistCoastalClubEnrichment(input);

    expect(result).toEqual(ok("skipped"));
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("skips when the external ref's internal id is not a club id", async () => {
    const { input, assetStorage } = makeInput({
      deps: { findExternalRef: vi.fn().mockResolvedValue(ok(makeRefRow("lea_abc123"))) },
    });

    const result = await persistCoastalClubEnrichment(input);

    expect(result).toEqual(ok("skipped"));
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("propagates a logo load failure", async () => {
    const { input, assetStorage } = makeInput({
      loadLogo: vi.fn().mockResolvedValue(serverError("no crest")),
    });

    const result = await persistCoastalClubEnrichment(input);

    expect(result.ok).toBe(false);
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("propagates an upload failure", async () => {
    const assetStorage = makeFakeAssetStorage();
    assetStorage.putObject.mockResolvedValue(serverError("r2 down"));
    const { input } = makeInput({ assetStorage });

    const result = await persistCoastalClubEnrichment(input);

    expect(result.ok).toBe(false);
  });
});
