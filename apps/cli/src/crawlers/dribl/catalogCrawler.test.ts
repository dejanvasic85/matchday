import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { countCatalogLeagues, crawlCatalog } from "#crawlers/dribl/catalogCrawler.ts";

const tenantResponse = { data: { id: "tenant-id" } };
const seasonsResponse = { data: [{ id: "season-id", name: "2026" }] };
const twoCompetitionsResponse = {
  data: [
    { id: "comp-1", name: "Senol NPL Victoria Men" },
    { id: "comp-2", name: "Senol NPL Victoria Women" },
  ],
};
const twoLeaguesResponse = {
  data: [
    { id: "league-1", name: "NPL VIC Men" },
    { id: "league-2", name: "NPL VIC Men - U20" },
  ],
};

function makeTableResponse(teamName: string) {
  return {
    data: [
      {
        type: "ladder-entry",
        id: "entry-1",
        attributes: {
          team_hash_id: "team-1",
          team_name: teamName,
          club_code: "OAKC",
          club_name: "Oakleigh Cannons FC",
          club_logo: "https://ocean.dribl.com/logo",
          season_name: "2026",
          league_name: "NPL VIC Men",
          position: 1,
          played: 20,
          won: 13,
          drawn: 5,
          lost: 2,
          goals_for: 43,
          goals_against: 18,
          goal_difference: 25,
          points: 44,
        },
      },
    ],
  };
}

const emptyTableResponse = { data: [] };

function makeFixtureResponse(
  fixtures: {
    hashId: string;
    homeName: string;
    homeId: string;
    awayName: string;
    awayId: string;
  }[],
) {
  return {
    data: fixtures.map(({ hashId, homeName, homeId, awayName, awayId }) => ({
      type: "fixtures",
      hash_id: hashId,
      attributes: {
        name: `${homeName} vs ${awayName}`,
        date: "2026-04-25T23:00:00.000000Z",
        round: "R1",
        full_round: "Round 1",
        ground_name: "AB Shaw Reserve",
        ground_latitude: -37.865571,
        ground_longitude: 144.783747,
        field_name: null,
        home_team_name: homeName,
        home_team_hash_id: homeId,
        home_logo: null,
        away_team_name: awayName,
        away_team_hash_id: awayId,
        away_logo: null,
        competition_name: "Coles MiniRoos Mixed Sunday (U6 - U11)",
        league_name: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue",
        status: "pending",
        bye_flag: false,
        home_score: null,
        away_score: null,
      },
    })),
  };
}

describe("crawlCatalog", () => {
  it("crawls every league for a single competition when maxLeagues is unset", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Senol NPL Victoria Men" }] },
      twoLeaguesResponse,
      makeTableResponse("Team A"),
      makeTableResponse("Team B"),
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    assert(result.ok);
    expect(result.value.map((r) => r.leagueName)).toEqual(["NPL VIC Men", "NPL VIC Men - U20"]);
  });

  it("caps leagues crawled per competition at maxLeagues", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      twoCompetitionsResponse,
      twoLeaguesResponse, // comp-1's leagues, listed while building the full queue
      twoLeaguesResponse, // comp-2's leagues, listed while building the full queue
      makeTableResponse("Team A"), // comp-1's capped league, crawled from the built queue
      makeTableResponse("Team A"), // comp-2's capped league, crawled from the built queue
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    assert(result.ok);
    expect(result.value).toHaveLength(2);
    expect(result.value.map((r) => r.competitionName)).toEqual([
      "Senol NPL Victoria Men",
      "Senol NPL Victoria Women",
    ]);
    expect(result.value.every((r) => r.leagueName === "NPL VIC Men")).toBe(true);
  });

  it("returns the mapped table entries for a crawled league", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Senol NPL Victoria Men" }] },
      { data: [{ id: "league-1", name: "NPL VIC Men" }] },
      makeTableResponse("Oakleigh Cannons FC Seniors"),
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          competitionSourceId: "comp-1",
          competitionName: "Senol NPL Victoria Men",
          leagueSourceId: "league-1",
          leagueName: "NPL VIC Men",
          seasonSourceId: "season-id",
          seasonName: "2026",
          fixtureTeams: [],
          tableEntries: [
            {
              teamSourceId: "team-1",
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
            },
          ],
        },
      ],
    });
  });

  it("returns err when no season matches the given year", async () => {
    const page = makeQueuedFakePage([tenantResponse, { data: [] }]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    assert(!result.ok);
  });

  it("returns ok with an empty result when no competitions are found", async () => {
    const page = makeQueuedFakePage([tenantResponse, seasonsResponse, { data: [] }]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("continues to the next competition when one has no leagues", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      twoCompetitionsResponse,
      { data: [] },
      twoLeaguesResponse,
      makeTableResponse("Team A"),
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    assert(result.ok);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.competitionName).toBe("Senol NPL Victoria Women");
  });

  it("falls back to fixtures to discover teams when a league has no table", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Coles MiniRoos Mixed Sunday (U6 - U11)" }] },
      { data: [{ id: "league-1", name: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue" }] },
      emptyTableResponse,
      makeFixtureResponse([
        {
          hashId: "fix-1",
          homeName: "Home Team",
          homeId: "home-1",
          awayName: "Away Team",
          awayId: "away-1",
        },
      ]),
      { data: [] },
      { data: [] },
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    assert(result.ok);
    expect(result.value[0]?.tableEntries).toEqual([]);
    expect(result.value[0]?.fixtureTeams).toEqual(
      expect.arrayContaining([
        { sourceId: "home-1", name: "Home Team" },
        { sourceId: "away-1", name: "Away Team" },
      ]),
    );
  });

  it("dedupes a team seen across multiple fixture-fallback rounds", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Coles MiniRoos Mixed Sunday (U6 - U11)" }] },
      { data: [{ id: "league-1", name: "Coles MiniRoos Mixed Sunday West 8 Kangaroos Blue" }] },
      emptyTableResponse,
      makeFixtureResponse([
        {
          hashId: "fix-1",
          homeName: "Home Team",
          homeId: "home-1",
          awayName: "Away Team",
          awayId: "away-1",
        },
      ]),
      makeFixtureResponse([
        {
          hashId: "fix-2",
          homeName: "Home Team",
          homeId: "home-1",
          awayName: "Bye Team",
          awayId: "bye-1",
        },
      ]),
      { data: [] },
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    assert(result.ok);
    expect(result.value[0]?.fixtureTeams).toHaveLength(3);
  });

  it("does not fall back to fixtures when a league's table already has entries", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Senol NPL Victoria Men" }] },
      { data: [{ id: "league-1", name: "NPL VIC Men" }] },
      makeTableResponse("Team A"),
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      maxLeagues: 1,
    });

    assert(result.ok);
    expect(result.value[0]?.fixtureTeams).toEqual([]);
  });

  it("crawls only the requested offset/limit window of the flat league queue", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      twoCompetitionsResponse,
      twoLeaguesResponse, // comp-1's leagues (queue indices 0, 1)
      twoLeaguesResponse, // comp-2's leagues (queue indices 2, 3)
      makeTableResponse("Team B"), // index 1: comp-1 / NPL VIC Men - U20
      makeTableResponse("Team C"), // index 2: comp-2 / NPL VIC Men
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      offset: 1,
      limit: 2,
    });

    assert(result.ok);
    expect(result.value.map((r) => `${r.competitionName}/${r.leagueName}`)).toEqual([
      "Senol NPL Victoria Men/NPL VIC Men - U20",
      "Senol NPL Victoria Women/NPL VIC Men",
    ]);
  });

  it("crawls to the end of the queue when only offset is given", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      { data: [{ id: "comp-1", name: "Senol NPL Victoria Men" }] },
      twoLeaguesResponse,
      makeTableResponse("Team B"),
    ]);

    const result = await crawlCatalog({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
      offset: 1,
    });

    assert(result.ok);
    expect(result.value.map((r) => r.leagueName)).toEqual(["NPL VIC Men - U20"]);
  });
});

describe("countCatalogLeagues", () => {
  it("counts every queued league without fetching any tables", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      twoCompetitionsResponse,
      twoLeaguesResponse,
      twoLeaguesResponse,
    ]);

    const result = await countCatalogLeagues({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
    });

    expect(result).toEqual({ ok: true, value: 4 });
  });

  it("applies maxLeagues per competition the same way crawlCatalog would", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      twoCompetitionsResponse,
      twoLeaguesResponse,
      twoLeaguesResponse,
    ]);

    const result = await countCatalogLeagues({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      maxLeagues: 1,
    });

    expect(result).toEqual({ ok: true, value: 2 });
  });

  it("propagates a tenant resolution failure", async () => {
    const page = makeQueuedFakePage([{ data: {} }]);

    const result = await countCatalogLeagues({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
    });

    assert(!result.ok);
  });
});
