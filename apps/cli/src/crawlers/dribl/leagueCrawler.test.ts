import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "#test/fixtures/rawStorage.ts";
import { crawlLeague } from "#crawlers/dribl/leagueCrawler.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");
const leagueId = "lea_abc123" as const;

function makeLeagueRow() {
  return {
    id: leagueId,
    name: "NPL VIC Men",
    competitionId: "cmp_abc123",
    seasonId: "sea_abc123",
    hasTable: true,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function makeExternalRefRow(sourceId: string) {
  return {
    id: "ext_row0000001",
    entityType: "league" as const,
    internalId: leagueId,
    source: "dribl" as const,
    sourceId,
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function makeFixtureResponse(count: number) {
  return {
    data: Array.from({ length: count }, (_unused, index) => ({
      type: "fixtures" as const,
      hash_id: `fixture-${index}`,
      attributes: {
        name: `Fixture ${index}`,
        date: "2026-04-25T23:00:00.000000Z",
        round: "R1",
        full_round: "Round 1",
        ground_name: "AB Shaw Reserve",
        ground_latitude: -37.86,
        ground_longitude: 144.78,
        field_name: null,
        home_team_name: "Home",
        home_team_hash_id: "home-1",
        home_logo: "https://ocean.dribl.com/home",
        away_team_name: "Away",
        away_team_hash_id: "away-1",
        away_logo: "https://ocean.dribl.com/away",
        competition_name: "Comp",
        league_name: "League",
        status: "pending",
        bye_flag: false,
        home_score: null,
        away_score: null,
      },
    })),
  };
}

const emptyFixturesResponse = { data: [] };

function makeTableResponse() {
  return {
    data: [
      {
        type: "ladder-entry" as const,
        id: "table-1",
        attributes: {
          team_hash_id: "team-1",
          team_name: "Home",
          club_code: "HFC",
          club_name: "Home FC",
          club_logo: "https://ocean.dribl.com/logo",
          season_name: "2026",
          league_name: "League",
          position: 1,
          played: 5,
          won: 4,
          drawn: 1,
          lost: 0,
          goals_for: 10,
          goals_against: 2,
          goal_difference: 8,
          points: 13,
        },
      },
    ],
  };
}

/** Resolves the league's Dribl hashes and every downstream lookup/upsert as a new entity. */
function makeHappyPathDeps() {
  return makeFakeEntityResolutionDeps({
    getLeagueById: vi.fn().mockResolvedValue(ok(makeLeagueRow())),
    findExternalRefByInternalId: vi
      .fn()
      .mockImplementation((entityType: string) =>
        Promise.resolve(ok(makeExternalRefRow(`${entityType}-hash`))),
      ),
    findExternalRef: vi.fn().mockResolvedValue(ok(null)),
    upsertExternalRef: vi.fn().mockResolvedValue(ok({ id: "ext_new00000001" })),
    findClubByLogoUrl: vi.fn().mockResolvedValue(ok(null)),
    findClubByName: vi.fn().mockResolvedValue(ok(null)),
    upsertClub: vi.fn().mockResolvedValue(ok({ id: "clb_new00000001" })),
    upsertTeam: vi.fn().mockResolvedValue(ok({ id: "tea_new00000001" })),
    upsertFixture: vi.fn().mockResolvedValue(ok({ id: "mtc_new00000001" })),
    upsertTableEntry: vi.fn().mockResolvedValue(ok({ id: "tab_new00000001" })),
    upsertLeagueTeam: vi.fn().mockResolvedValue(ok({ id: "lgt_new00000001" })),
  });
}

describe("crawlLeague", () => {
  it("crawls and persists a league's fixtures and table", async () => {
    const page = makeQueuedFakePage([
      makeFixtureResponse(1),
      emptyFixturesResponse,
      emptyFixturesResponse,
      makeTableResponse(),
    ]);
    const rawStorage = makeFakeRawStorage();
    const deps = makeHappyPathDeps();

    const result = await crawlLeague({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      deps,
      leagueId,
      tenantId: "tenant-1",
      dryRun: false,
      generateCrawlRunId: () => "run_1",
    });

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 1 }));
    expect(deps.upsertFixture).toHaveBeenCalledTimes(1);
    expect(deps.upsertTableEntry).toHaveBeenCalledTimes(1);
    expect(rawStorage.puts.map((put) => put.key)).toEqual([
      "deep/lea_abc123/run_1/fixtures-round-1.json",
      "deep/lea_abc123/run_1/table.json",
    ]);
  });

  it("stages to R2 but skips persisting on a dry run", async () => {
    const page = makeQueuedFakePage([
      makeFixtureResponse(1),
      emptyFixturesResponse,
      emptyFixturesResponse,
      makeTableResponse(),
    ]);
    const rawStorage = makeFakeRawStorage();
    const deps = makeHappyPathDeps();

    const result = await crawlLeague({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      deps,
      leagueId,
      tenantId: "tenant-1",
      dryRun: true,
      generateCrawlRunId: () => "run_1",
    });

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 1 }));
    expect(rawStorage.puts).toHaveLength(2);
    expect(deps.upsertFixture).not.toHaveBeenCalled();
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });

  it("propagates a resolveDriblLeagueIds failure without crawling", async () => {
    const deps = makeFakeEntityResolutionDeps({
      getLeagueById: vi.fn().mockResolvedValue(ok(null)),
    });
    const page = makeQueuedFakePage([]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlLeague({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      deps,
      leagueId,
      tenantId: "tenant-1",
      dryRun: false,
      generateCrawlRunId: () => "run_1",
    });

    assert(!result.ok);
    expect(rawStorage.puts).toHaveLength(0);
  });

  it("propagates a crawlFixturesByRound failure without crawling the table", async () => {
    const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);
    const rawStorage = makeFakeRawStorage();
    const deps = makeHappyPathDeps();

    const result = await crawlLeague({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      deps,
      leagueId,
      tenantId: "tenant-1",
      dryRun: false,
      generateCrawlRunId: () => "run_1",
    });

    assert(!result.ok);
    expect(rawStorage.puts).toHaveLength(0);
  });
});
