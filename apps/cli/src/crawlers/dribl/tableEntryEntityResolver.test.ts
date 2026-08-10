import { ok } from "@matchday/domain";
import type { MappedTableEntry } from "./mappers/mapDriblTableEntry.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { resolveTableEntryEntities } from "./tableEntryEntityResolver.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeMappedTableEntry(overrides: Partial<MappedTableEntry> = {}): MappedTableEntry {
  return {
    teamSourceId: "team-source-1",
    teamName: "Altona North SC U08",
    clubCode: "ANSC",
    clubName: "Altona North SC",
    clubLogoUrl: "https://ocean.dribl.com/logo",
    leagueName: "League",
    seasonName: "2026",
    position: 1,
    played: 5,
    won: 4,
    drawn: 1,
    lost: 0,
    goalsFor: 12,
    goalsAgainst: 3,
    goalDifference: 9,
    points: 13,
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

function makeExternalRefRow() {
  return {
    id: "ext_row0000001",
    entityType: "team" as const,
    internalId: "tea_existing001",
    source: "dribl" as const,
    sourceId: "team-source-1",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

const context = {
  competitionId: "cmp_abc123" as const,
  seasonId: "sea_abc123" as const,
  leagueId: "lea_abc123" as const,
};

describe("resolveTableEntryEntities", () => {
  it("resolves the club (via club_code bridge) and team, then upserts the table entry", async () => {
    const deps = makeFakeEntityResolutionDeps({
      // The club_code ref lookup misses (bridging via logo below); the team ref lookup hits.
      findExternalRef: vi
        .fn()
        .mockImplementation((source: string) =>
          Promise.resolve(ok(source === "dribl_club_code" ? null : makeExternalRefRow())),
        ),
      findClubByLogoUrl: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertExternalRef: vi.fn().mockResolvedValue(ok({ id: "ext_new00000001" })),
      upsertClub: vi.fn().mockResolvedValue(ok(makeClubRow())),
      upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_existing001" })),
      upsertTableEntry: vi.fn().mockResolvedValue(ok({ id: "tab_new00000001" })),
    });

    const result = await resolveTableEntryEntities(deps, makeMappedTableEntry(), context);

    assert(result.ok);
    expect(deps.upsertTableEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "tea_existing001",
        leagueId: "lea_abc123",
        competitionId: "cmp_abc123",
        seasonId: "sea_abc123",
        position: 1,
        points: 13,
      }),
    );
  });

  it("propagates a team resolution failure without upserting the table entry", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      findClubByLogoUrl: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });

    const result = await resolveTableEntryEntities(deps, makeMappedTableEntry(), context);

    assert(!result.ok);
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });
});
