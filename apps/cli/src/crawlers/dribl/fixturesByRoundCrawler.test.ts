import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { makeFakeRawStorage } from "#test/fixtures/rawStorage.ts";
import type { DriblLeagueIds } from "#crawlers/dribl/driblApiUrl.ts";
import type { DriblFixtureAttributes } from "#crawlers/dribl/external/driblFixture.ts";
import { crawlFixturesByRound } from "#crawlers/dribl/fixturesByRoundCrawler.ts";

const ids: DriblLeagueIds = { season: "s", competition: "c", league: "l", tenant: "t" };

function makeFixtureAttributes(
  overrides: Partial<DriblFixtureAttributes> = {},
): DriblFixtureAttributes {
  return {
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
    ...overrides,
  };
}

function makeFixtureResponse(count: number) {
  return {
    data: Array.from({ length: count }, (_unused, index) => ({
      type: "fixtures" as const,
      hash_id: `fixture-${index}`,
      attributes: makeFixtureAttributes({ name: `Fixture ${index}` }),
    })),
  };
}

const emptyResponse = { data: [] };

describe("crawlFixturesByRound", () => {
  it("stages each non-empty round to R2 and stops after two consecutive empty rounds", async () => {
    const page = makeQueuedFakePage([
      makeFixtureResponse(2),
      makeFixtureResponse(1),
      emptyResponse,
      emptyResponse,
    ]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlFixturesByRound({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      leagueId: "lea_abc123",
      crawlRunId: "run_1",
    });

    assert(result.ok);
    expect(rawStorage.puts).toHaveLength(2);
    expect(rawStorage.puts[0]?.key).toBe("deep/lea_abc123/run_1/fixtures-round-1.json");
    expect(rawStorage.puts[1]?.key).toBe("deep/lea_abc123/run_1/fixtures-round-2.json");
  });

  it("continues past a single empty round (scheduling gap, not season end)", async () => {
    const page = makeQueuedFakePage([
      makeFixtureResponse(1),
      emptyResponse,
      makeFixtureResponse(1),
      emptyResponse,
      emptyResponse,
    ]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlFixturesByRound({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      leagueId: "lea_abc123",
      crawlRunId: "run_1",
    });

    assert(result.ok);
    expect(rawStorage.puts).toHaveLength(2);
  });

  it("stages a round containing an unstructured placeholder fixture (null name)", async () => {
    const response = {
      data: [
        {
          type: "fixtures" as const,
          hash_id: "fixture-0",
          attributes: makeFixtureAttributes({ name: null }),
        },
      ],
    };
    const page = makeQueuedFakePage([response, emptyResponse, emptyResponse]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlFixturesByRound({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      leagueId: "lea_abc123",
      crawlRunId: "run_1",
    });

    assert(result.ok);
    expect(rawStorage.puts).toHaveLength(1);
  });

  it("returns err when a round's response fails schema validation", async () => {
    const page = makeQueuedFakePage([{ data: [{ bad: "shape" }] }]);
    const rawStorage = makeFakeRawStorage();

    const result = await crawlFixturesByRound({
      page,
      rawStorage,
      logger: makeFakeLogger(),
      ids,
      leagueId: "lea_abc123",
      crawlRunId: "run_1",
    });

    assert(!result.ok);
    expect(rawStorage.puts).toHaveLength(0);
  });

  it("warns when the crawl hits the maxRounds safety cap without a natural stop", async () => {
    const page = makeQueuedFakePage(Array.from({ length: 40 }, () => makeFixtureResponse(1)));
    const rawStorage = makeFakeRawStorage();
    const logger = makeFakeLogger();

    const result = await crawlFixturesByRound({
      page,
      rawStorage,
      logger,
      ids,
      leagueId: "lea_abc123",
      crawlRunId: "run_1",
    });

    assert(result.ok);
    expect(logger.warn).toHaveBeenCalledWith(
      "crawl.fixturesRound",
      "hit maxRounds safety cap without a natural stop",
      { maxRounds: 40 },
    );
  });
});
