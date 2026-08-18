import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { resolveTeamForFixture, resolveTeamForTableEntry } from "#crawlers/dribl/teamResolver.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeExternalRefRow(overrides: Partial<{ internalId: string }> = {}) {
  return {
    id: "ext_row0000001",
    entityType: "team",
    internalId: "tea_existing001",
    source: "dribl" as const,
    sourceId: "team-source-1",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

function makeClubRow() {
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
  };
}

function makeTeamRow(overrides: Partial<{ clubId: string | null }> = {}) {
  return {
    id: "tea_existing001",
    clubId: null,
    name: "Under 9 Boys Joeys",
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

describe("resolveTeamForFixture", () => {
  it("returns the team id when an external_ref already exists and it's already linked", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      getTeamById: vi.fn().mockResolvedValue(ok(makeTeamRow({ clubId: "clb_existing0001" }))),
    });

    const result = await resolveTeamForFixture(deps, "team-source-1", "Under 9 Boys Joeys", null);

    expect(result).toEqual({ ok: true, value: "tea_existing001" });
    expect(deps.upsertTeam).not.toHaveBeenCalled();
  });

  it("bridges an already-known but unlinked team to a club by logo on a later sighting", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      getTeamById: vi.fn().mockResolvedValue(ok(makeTeamRow({ clubId: null }))),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertTeam: vi
        .fn()
        .mockResolvedValue(ok({ id: "tea_existing001", clubId: "clb_existing0001" })),
    });

    const result = await resolveTeamForFixture(
      deps,
      "team-source-1",
      "Altona North SC U08",
      "https://ocean.dribl.com/logo",
    );

    assert(result.ok);
    expect(result.value).toBe("tea_existing001");
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tea_existing001", clubId: "clb_existing0001" }),
    );
  });

  it("leaves an unlinked team unlinked when no club bridges yet", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      getTeamById: vi.fn().mockResolvedValue(ok(makeTeamRow({ clubId: null }))),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await resolveTeamForFixture(
      deps,
      "team-source-1",
      "Under 9 Boys Joeys",
      "https://ocean.dribl.com/logo",
    );

    expect(result).toEqual({ ok: true, value: "tea_existing001" });
    expect(deps.upsertTeam).not.toHaveBeenCalled();
  });

  it("creates a team bridged to a club by logo on first sight of this Dribl id", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertTeam: vi
        .fn()
        .mockResolvedValue(ok({ id: "tea_new00000001", clubId: "clb_existing0001" })),
    });

    const result = await resolveTeamForFixture(
      deps,
      "team-source-unknown",
      "Altona North SC U08",
      "https://ocean.dribl.com/logo",
    );

    assert(result.ok);
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: "clb_existing0001",
        name: "Altona North SC U08",
      }),
    );
  });

  it("creates an unlinked team (no club) on first sight when no club bridges", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
      findClubByName: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_new00000001", clubId: null })),
    });

    const result = await resolveTeamForFixture(
      deps,
      "team-source-unknown",
      "Under 9 Boys Joeys - Dragan/Cian",
      null,
    );

    assert(result.ok);
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: null,
        name: "Under 9 Boys Joeys - Dragan/Cian",
      }),
    );
  });

  it("propagates a lookup failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveTeamForFixture(deps, "team-source-1", "Under 9 Boys Joeys", null);

    assert(!result.ok);
  });
});

describe("resolveTeamForTableEntry", () => {
  it("resolves the club via club_code, then creates the team on first sight", async () => {
    const deps = makeFakeEntityResolutionDeps({
      // Both the club_code ref lookup (resolveClub) and the team ref lookup
      // (resolveEntityByExternalRef) miss here, so a single blanket `null` covers both.
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertTeam: vi
        .fn()
        .mockResolvedValue(ok({ id: "tea_new00000001", clubId: "clb_existing0001" })),
    });

    const result = await resolveTeamForTableEntry({
      deps,
      teamSourceId: "team-source-1",
      teamName: "Altona North SC U08",
      clubName: "Altona North SC",
      clubLogoUrl: "https://ocean.dribl.com/logo",
      clubCode: "ANSC",
    });

    assert(result.ok);
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: "clb_existing0001", name: "Altona North SC U08" }),
    );
  });

  it("propagates a club resolution failure without attempting to resolve the team", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveTeamForTableEntry({
      deps,
      teamSourceId: "team-source-1",
      teamName: "Altona North SC U08",
      clubName: "Altona North SC",
      clubLogoUrl: "https://ocean.dribl.com/logo",
      clubCode: "ANSC",
    });

    assert(!result.ok);
    expect(deps.upsertTeam).not.toHaveBeenCalled();
  });
});
