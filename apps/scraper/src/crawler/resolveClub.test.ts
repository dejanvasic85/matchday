import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { resolveClub } from "./resolveClub.ts";

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
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

describe("resolveClub", () => {
  it("returns the existing club id when a logo match is found", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await resolveClub({
      deps,
      name: "Altona North SC",
      logoUrl: "https://ocean.dribl.com/logo",
    });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
    expect(deps.findClubByName).not.toHaveBeenCalled();
  });

  it("falls back to a name match when no logo match is found", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    const result = await resolveClub({
      deps,
      name: "Altona North SC",
      logoUrl: "https://ocean.dribl.com/logo",
    });

    expect(result).toEqual({ ok: true, value: "clb_existing0001" });
  });

  it("skips the logo lookup entirely when logoUrl is null", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByName: vi.fn().mockResolvedValue(ok(makeClubRow())),
    });

    await resolveClub({ deps, name: "Altona North SC", logoUrl: null });

    expect(deps.findClubByLogoUrl).not.toHaveBeenCalled();
  });

  it("creates a new club when neither logo nor name matches", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow({ id: "clb_new00000001" }))),
    });

    const result = await resolveClub({
      deps,
      name: "New Club FC",
      logoUrl: "https://ocean.dribl.com/new-logo",
    });

    expect(result.ok).toBe(true);
    expect(deps.upsertClub).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Club FC", displayName: "New Club FC" }),
    );
  });

  it("propagates a lookup failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findClubByLogoUrl: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveClub({
      deps,
      name: "Altona North SC",
      logoUrl: "https://ocean.dribl.com/logo",
    });

    expect(result.ok).toBe(false);
  });
});
