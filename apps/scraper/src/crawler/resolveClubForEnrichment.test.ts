import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { resolveClubForEnrichment } from "./resolveClubForEnrichment.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(overrides: Partial<{ id: string; name: string }> = {}) {
  return {
    id: "clb_existing0001",
    name: "Aintree SC",
    displayName: "Aintree SC",
    logoUrl: "https://ocean.dribl.com/logo",
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

function makeExternalRefRow(overrides: Partial<{ internalId: string }> = {}) {
  return {
    id: "ext_row0000001",
    entityType: "club",
    internalId: "clb_existing0001",
    source: "dribl" as const,
    sourceId: "3vmZv3YLmq",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

const baseInput = {
  sourceId: "3vmZv3YLmq",
  name: "Aintree SC",
  logoUrl: "https://ocean.dribl.com/logo",
};

describe("resolveClubForEnrichment", () => {
  it("resolves directly via an existing dribl external_ref, skipping bridge lookups", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
    expect(deps.findClubByName).not.toHaveBeenCalled();
    expect(deps.upsertExternalRef).not.toHaveBeenCalled();
  });

  it("bridges via a logo match and persists the ref with sourceUrl", async () => {
    const upsertExternalRef = vi.fn().mockResolvedValue(ok(makeExternalRefRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      findExternalRefByInternalId: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef,
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
    expect(deps.findClubByName).not.toHaveBeenCalled();
    expect(upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "club",
        internalId: "clb_existing0001",
        source: "dribl",
        sourceId: "3vmZv3YLmq",
        sourceUrl: "https://ocean.dribl.com/logo",
      }),
    );
  });

  it("bridges via a name match when no logo match is found", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
      findExternalRefByInternalId: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
  });

  it("resolves to null when the bridge match already has a dribl ref under a different source id (duplicate Dribl club entry), without racing the unique constraint", async () => {
    const upsertExternalRef = vi.fn();
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow({ internalId: "clb_existing0001" }))),
      upsertExternalRef,
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: null });
    expect(upsertExternalRef).not.toHaveBeenCalled();
  });

  it("resolves to null when no match anywhere, without writing anything (never creates)", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await resolveClubForEnrichment({
      deps,
      sourceId: "RwNl35aZmj",
      name: "FV Albury Wodonga Referees",
      logoUrl: "https://ocean.dribl.com/placeholder",
    });

    expect(result).toEqual({ ok: true, value: null });
    expect(deps.upsertExternalRef).not.toHaveBeenCalled();
  });

  it("skips the logo lookup when logoUrl is null", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
    });

    await resolveClubForEnrichment({ ...baseInput, deps, logoUrl: null });

    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
  });

  it("propagates a findExternalRef failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("propagates a findExternalRefByInternalId failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      findExternalRefByInternalId: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("returns err when the matched external_ref's internalId has an unexpected prefix", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow({ internalId: "tea_wrong_prefix" }))),
    });

    const result = await resolveClubForEnrichment({ deps, ...baseInput });

    assert(!result.ok);
  });
});
