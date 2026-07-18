import { makeFakeLogger } from "@/test/fixtures/logger.ts";
import { makeQueuedFakePage } from "@/test/fixtures/fakePage.ts";
import { crawlCatalogDebug } from "./crawlCatalogDebug.ts";

const tenantResponse = { data: { id: "tenant-id" } };
const seasonsResponse = { data: [{ id: "season-id", name: "2026" }] };
const competitionsResponse = {
  data: [
    { id: "comp-1", name: "Senol NPL Victoria Men" },
    { id: "comp-2", name: "Senol NPL Victoria Women" },
  ],
};
const leaguesResponse = {
  data: [
    { id: "league-1", name: "NPL VIC Men" },
    { id: "league-2", name: "NPL VIC Men - U20" },
  ],
};
const tableResponse = {
  data: [
    {
      type: "ladder-entry",
      id: "entry-1",
      attributes: {
        team_hash_id: "team-1",
        team_name: "Oakleigh Cannons FC Seniors",
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

describe("crawlCatalogDebug", () => {
  it("selects the first competition and first league, returning the mapped table", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      competitionsResponse,
      leaguesResponse,
      tableResponse,
    ]);

    const result = await crawlCatalogDebug({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        competitionName: "Senol NPL Victoria Men",
        leagueName: "NPL VIC Men",
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
    });
  });

  it("returns err when no season matches the given year", async () => {
    const page = makeQueuedFakePage([tenantResponse, { data: [] }]);

    const result = await crawlCatalogDebug({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    expect(result.ok).toBe(false);
  });

  it("returns err when no competitions are found", async () => {
    const page = makeQueuedFakePage([tenantResponse, seasonsResponse, { data: [] }]);

    const result = await crawlCatalogDebug({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    expect(result.ok).toBe(false);
  });

  it("returns err when the selected competition has no leagues", async () => {
    const page = makeQueuedFakePage([
      tenantResponse,
      seasonsResponse,
      competitionsResponse,
      { data: [] },
    ]);

    const result = await crawlCatalogDebug({
      page,
      logger: makeFakeLogger(),
      tenantHost: "fv.dribl.com",
      tenantSlug: "fv",
      seasonYear: "2026",
    });

    expect(result.ok).toBe(false);
  });
});
