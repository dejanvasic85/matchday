import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { resolveClub } from "./clubResolver.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeClubRow(overrides: Partial<{ id: string; name: string }> = {}) {
  return {
    id: "clb_existing0001",
    name: "Altona North SC",
    displayName: "Altona North SC",
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
    source: "dribl_club_code" as const,
    sourceId: "club-code-1",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

const baseInput = {
  name: "Altona North SC",
  logoUrl: "https://ocean.dribl.com/logo",
  clubCode: "club-code-1",
};

describe("resolveClub", () => {
  it("returns the club id via an existing club_code ref, skipping logo/name lookups", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await resolveClub({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
    expect(deps.findClubByName).not.toHaveBeenCalled();
    expect(deps.upsertExternalRef).not.toHaveBeenCalled();
  });

  it("passes a null logoUrl once a club is identity-resolved, so upsertClub's COALESCE leaves an enrichment-set logo alone", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    await resolveClub({ deps, ...baseInput });

    expect(deps.upsertClub).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: null }));
  });

  it("bridges via a logo match when no club_code ref exists yet, writing the ref", async () => {
    const upsertExternalRef = vi.fn().mockResolvedValue(ok(makeExternalRefRow()));
    const upsertClub = vi.fn().mockResolvedValue(ok(makeClubRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef,
      upsertClub,
    });

    const result = await resolveClub({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
    expect(deps.findClubByName).not.toHaveBeenCalled();
    expect(upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "club",
        internalId: "clb_existing0001",
        source: "dribl_club_code",
        sourceId: "club-code-1",
      }),
    );
    const refOrder = upsertExternalRef.mock.invocationCallOrder[0];
    const clubOrder = upsertClub.mock.invocationCallOrder[0];
    expect(refOrder).toBeLessThan(clubOrder);
  });

  it("bridges via a name match when no logo match is found", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await resolveClub({ deps, ...baseInput });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
  });

  it("skips the logo lookup entirely when logoUrl is null", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    await resolveClub({ ...baseInput, deps, logoUrl: null });

    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
  });

  it("creates a brand new club when no ref, logo, or name matches", async () => {
    const upsertExternalRef = vi.fn().mockResolvedValue(ok(makeExternalRefRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef,
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow({ id: "clb_new00000001" }))),
    });

    const result = await resolveClub({
      deps,
      name: "New Club FC",
      logoUrl: "https://ocean.dribl.com/new-logo",
      clubCode: "club-code-new",
    });

    assert(result.ok);
    expect(upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "club",
        source: "dribl_club_code",
        sourceId: "club-code-new",
      }),
    );
    expect(deps.upsertClub).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Club FC", displayName: "New Club FC" }),
    );
  });

  it("propagates a findExternalRef failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("propagates a findClubByLogoUrl failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("propagates a findClubByName failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("propagates an upsertExternalRef failure during the bridge", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
    expect(deps.upsertClub).not.toHaveBeenCalled();
  });

  it("propagates an upsertClub failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
  });

  it("returns err when the matched external_ref's internalId has an unexpected prefix", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow({ internalId: "tea_wrong_prefix" }))),
    });

    const result = await resolveClub({ deps, ...baseInput });

    assert(!result.ok);
    expect(deps.upsertClub).not.toHaveBeenCalled();
  });
});
