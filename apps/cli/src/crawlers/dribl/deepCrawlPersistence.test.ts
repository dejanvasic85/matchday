import { ok } from "@matchday/domain";
import type { DriblFixturesApiResponse } from "#crawlers/dribl/external/driblFixture.ts";
import type { DriblTableApiResponse } from "#crawlers/dribl/external/driblTableEntry.ts";
import { makeFakeEntityResolutionDeps } from "#test/fixtures/entityResolutionDeps.ts";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { deepCrawlPersist } from "#crawlers/dribl/deepCrawlPersistence.ts";
import type { DeepCrawlLeagueContext } from "#crawlers/dribl/driblLeagueIdResolver.ts";

function makeFixtureResponse(hashId: string): DriblFixturesApiResponse {
  return {
    data: [
      {
        type: "fixtures",
        hash_id: hashId,
        attributes: {
          name: "Fixture",
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
      },
    ],
  };
}

function makeTableResponse(): DriblTableApiResponse {
  return {
    data: [
      {
        type: "ladder-entry",
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

const context: DeepCrawlLeagueContext = {
  competitionId: "cmp_abc123",
  seasonId: "sea_abc123",
  leagueId: "lea_abc123",
  hasTable: true,
};

/** All lookups miss (new entities) and every upsert succeeds. */
function makeHappyPathDeps() {
  return makeFakeEntityResolutionDeps({
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

describe("deepCrawlPersist", () => {
  it("persists every fixture and table entry, returning a count summary", async () => {
    const deps = makeHappyPathDeps();

    const result = await deepCrawlPersist({
      deps,
      logger: makeFakeLogger(),
      context,
      fixtureResponses: [makeFixtureResponse("fixture-1"), makeFixtureResponse("fixture-2")],
      tableResponse: makeTableResponse(),
    });

    expect(result).toEqual(ok({ fixtures: 2, tableEntries: 1 }));
    expect(deps.upsertFixture).toHaveBeenCalledTimes(2);
    expect(deps.upsertTableEntry).toHaveBeenCalledTimes(1);
  });

  it("treats an undefined table response (no table) as zero table entries", async () => {
    const deps = makeHappyPathDeps();

    const result = await deepCrawlPersist({
      deps,
      logger: makeFakeLogger(),
      context,
      fixtureResponses: [makeFixtureResponse("fixture-1")],
      tableResponse: undefined,
    });

    expect(result).toEqual(ok({ fixtures: 1, tableEntries: 0 }));
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });

  it("stops on the first fixture failure without persisting the table", async () => {
    const deps = makeHappyPathDeps();
    deps.upsertFixture = vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } });

    const result = await deepCrawlPersist({
      deps,
      logger: makeFakeLogger(),
      context,
      fixtureResponses: [makeFixtureResponse("fixture-1")],
      tableResponse: makeTableResponse(),
    });

    assert(!result.ok);
    expect(deps.upsertTableEntry).not.toHaveBeenCalled();
  });

  it("stops mid-table-loop on the first table entry failure", async () => {
    const deps = makeHappyPathDeps();
    deps.upsertTableEntry = vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } });

    const result = await deepCrawlPersist({
      deps,
      logger: makeFakeLogger(),
      context,
      fixtureResponses: [],
      tableResponse: makeTableResponse(),
    });

    assert(!result.ok);
  });
});
