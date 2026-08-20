import { ok } from "@matchday/domain";
import { findClubBridgeMatch } from "#crawlers/dribl/clubBridgeResolver.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(overrides: Partial<{ id: string }> = {}) {
  return {
    id: "clb_existing0001",
    name: "Altona North SC",
    displayName: "Altona North SC",
    logoUrl: "https://pub-abc.r2.dev/logos/clb_existing0001-abc123.png",
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

describe("findClubBridgeMatch", () => {
  it("matches via external_ref.sourceUrl first, without falling back to club.logoUrl or name", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByExternalRefSourceUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await findClubBridgeMatch(
      deps,
      "Altona North SC U08",
      "https://ocean.dribl.com/logo",
    );

    expect(result).toEqual(ok("clb_existing0001"));
    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
    expect(deps.findClubByName).not.toHaveBeenCalled();
  });

  it("falls back to club.logoUrl when no external_ref matches", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByExternalRefSourceUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await findClubBridgeMatch(
      deps,
      "Altona North SC U08",
      "https://ocean.dribl.com/logo",
    );

    expect(result).toEqual(ok("clb_existing0001"));
    expect(deps.findClubByName).not.toHaveBeenCalled();
  });

  it("falls back to an exact name match when no ref or logo matches", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByExternalRefSourceUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await findClubBridgeMatch(
      deps,
      "Altona North SC",
      "https://ocean.dribl.com/logo",
    );

    expect(result).toEqual(ok("clb_existing0001"));
  });

  it("skips both logo lookups and goes straight to name when logoUrl is null", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await findClubBridgeMatch(deps, "Altona North SC", null);

    expect(result).toEqual(ok("clb_existing0001"));
    expect(deps.findClubByExternalRefSourceUrl).not.toHaveBeenCalled();
    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
  });

  it("returns null when nothing matches anywhere", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByExternalRefSourceUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await findClubBridgeMatch(deps, "Unknown FC", "https://ocean.dribl.com/logo");

    expect(result).toEqual(ok(null));
  });

  it("propagates a findClubByExternalRefSourceUrl failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByExternalRefSourceUrl: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await findClubBridgeMatch(
      deps,
      "Altona North SC",
      "https://ocean.dribl.com/logo",
    );

    assert(!result.ok);
  });
});
