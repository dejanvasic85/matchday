import { makeFakeLogger } from "#test/fixtures/logger.ts";
import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import { crawlCatalog } from "#crawlers/dribl/catalogCrawler.ts";

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
      twoLeaguesResponse,
      makeTableResponse("Team A"),
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
});
