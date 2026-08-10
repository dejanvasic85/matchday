import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@test/fixtures/entityResolutionDeps.ts";
import { resolveTeamForFixture, resolveTeamForTableEntry } from "./teamResolver.ts";

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

describe("resolveTeamForFixture", () => {
  it("returns the team id when an external_ref already exists", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });

    const result = await resolveTeamForFixture(deps, "team-source-1");

    expect(result).toEqual({ ok: true, value: "tea_existing001" });
  });

  it("returns null (not an error) when no team with this Dribl id has been seen yet", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
    });

    const result = await resolveTeamForFixture(deps, "team-source-unknown");

    expect(result).toEqual({ ok: true, value: null });
  });

  it("propagates a lookup failure", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveTeamForFixture(deps, "team-source-1");

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
