import { ok } from "@matchday/domain";
import type { MappedTableEntry } from "#crawlers/dribl/mappers/mapDriblTableEntry.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import type { CrawlCatalogLeagueResult } from "#crawlers/dribl/catalogCrawler.ts";
import { persistCatalog } from "#crawlers/dribl/catalogPersistence.ts";

function makeTableEntry(overrides: Partial<MappedTableEntry> = {}): MappedTableEntry {
  return {
    teamSourceId: "team-source-1",
    teamName: "Oakleigh Cannons FC Seniors",
    clubCode: "OAKC",
    clubName: "Oakleigh Cannons FC",
    clubLogoUrl: "https://ocean.dribl.com/logo",
    leagueName: "NPL VIC Men",
    seasonName: "2026",
    position: 1,
    played: 20,
    won: 13,
    drawn: 5,
    lost: 2,
    goalsFor: 43,
    goalsAgainst: 18,
    goalDifference: 25,
    points: 44,
    ...overrides,
  };
}

function makeLeague(overrides: Partial<CrawlCatalogLeagueResult> = {}): CrawlCatalogLeagueResult {
  return {
    competitionSourceId: "comp-src-1",
    competitionName: "Senol NPL Victoria Men",
    leagueSourceId: "league-src-1",
    leagueName: "NPL VIC Men",
    seasonSourceId: "season-src-1",
    seasonName: "2026",
    tableEntries: [makeTableEntry()],
    fixtureTeams: [],
    ...overrides,
  };
}

/** All lookups miss (new entities) and every upsert succeeds. */
function makeHappyPathDeps() {
  return makeFakeEntityResolutionDeps({
    findExternalRef: vi.fn().mockResolvedValue(ok(null)),
    upsertExternalRef: vi.fn().mockResolvedValue(ok({ id: "ext_new00000001" })),
    upsertCompetition: vi.fn().mockResolvedValue(ok({ id: "cmp_new00000001" })),
    upsertSeason: vi.fn().mockResolvedValue(ok({ id: "sea_new00000001" })),
    upsertLeague: vi.fn().mockResolvedValue(ok({ id: "lea_new00000001" })),
    findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
    findClubByName: vi.fn().mockResolvedValue(ok(null)),
    upsertClub: vi.fn().mockResolvedValue(ok({ id: "clb_new00000001" })),
    upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_new00000001" })),
    upsertTableEntry: vi.fn().mockResolvedValue(ok({ id: "tab_new00000001" })),
  });
}

describe("persistCatalog", () => {
  it("upserts competition, season and league, then the table entry, for a crawled league", async () => {
    const deps = makeHappyPathDeps();

    const result = await persistCatalog({
      deps,
      logger: makeFakeLogger(),
      leagues: [makeLeague()],
    });

    expect(result).toEqual(ok({ leagues: 1, tableEntries: 1, fixtureTeams: 0 }));
    expect(deps.upsertCompetition).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Senol NPL Victoria Men" }),
    );
    expect(deps.upsertSeason).toHaveBeenCalledWith(expect.objectContaining({ name: "2026" }));
    // resolveEntityByExternalRef generates a fresh internal id for a new entity (the mock's
    // returned row id is ignored), so assert on the id *prefix*, not an exact value.
    expect(deps.upsertLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "NPL VIC Men",
        competitionId: expect.stringMatching(/^cmp_/),
        seasonId: expect.stringMatching(/^sea_/),
      }),
    );
    expect(deps.upsertTableEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        leagueId: expect.stringMatching(/^lea_/),
        competitionId: expect.stringMatching(/^cmp_/),
        seasonId: expect.stringMatching(/^sea_/),
        teamId: expect.stringMatching(/^tea_/),
        position: 1,
        points: 44,
      }),
    );
  });

  it("writes an external_ref for each newly-created catalog entity", async () => {
    const deps = makeHappyPathDeps();

    await persistCatalog({ deps, logger: makeFakeLogger(), leagues: [makeLeague()] });

    const entityTypes = vi.mocked(deps.upsertExternalRef).mock.calls.map(([ref]) => ref.entityType);
    expect(entityTypes).toEqual(
      expect.arrayContaining(["competition", "season", "league", "team"]),
    );
  });

  it("counts table entries across multiple leagues", async () => {
    const deps = makeHappyPathDeps();

    const result = await persistCatalog({
      deps,
      logger: makeFakeLogger(),
      leagues: [
        makeLeague({ tableEntries: [makeTableEntry(), makeTableEntry({ position: 2 })] }),
        makeLeague({ leagueSourceId: "league-src-2", tableEntries: [makeTableEntry()] }),
      ],
    });

    expect(result).toEqual(ok({ leagues: 2, tableEntries: 3, fixtureTeams: 0 }));
  });

  it("persists fixture-discovered teams (unlinked, no club) for a table-less league", async () => {
    const deps = makeHappyPathDeps();

    const result = await persistCatalog({
      deps,
      logger: makeFakeLogger(),
      leagues: [
        makeLeague({
          tableEntries: [],
          fixtureTeams: [
            { sourceId: "home-1", name: "Under 9 Boys Joeys - Dragan/Cian", logoUrl: null },
            { sourceId: "away-1", name: "Under 9 Boys Wallabies - Eric/Nate", logoUrl: null },
          ],
        }),
      ],
    });

    expect(result).toEqual(ok({ leagues: 1, tableEntries: 0, fixtureTeams: 2 }));
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: null, name: "Under 9 Boys Joeys - Dragan/Cian" }),
    );
    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: null, name: "Under 9 Boys Wallabies - Eric/Nate" }),
    );
  });

  it("links a fixture-discovered team to a club whose logo bridges", async () => {
    const deps = makeHappyPathDeps();
    deps.findClubByLogoUrl = vi
      .fn()
      .mockResolvedValue(ok({ id: "clb_existing0001", name: "Williamstown SC" }));

    await persistCatalog({
      deps,
      logger: makeFakeLogger(),
      leagues: [
        makeLeague({
          tableEntries: [],
          fixtureTeams: [
            {
              sourceId: "home-1",
              name: "Williamstown SC U08",
              logoUrl: "https://ocean.dribl.com/wsc-logo",
            },
          ],
        }),
      ],
    });

    expect(deps.upsertTeam).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: "clb_existing0001", name: "Williamstown SC U08" }),
    );
  });

  it("returns err and stops when a competition upsert fails", async () => {
    const deps = makeHappyPathDeps();
    deps.upsertCompetition = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { message: "db down" } });

    const result = await persistCatalog({
      deps,
      logger: makeFakeLogger(),
      leagues: [makeLeague()],
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertLeague).not.toHaveBeenCalled();
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });
});
