import { buildDriblApiUrl, type DriblLeagueIds } from "./buildDriblApiUrl.ts";

const ids: DriblLeagueIds = {
  season: "season-id",
  competition: "competition-id",
  league: "league-id",
  tenant: "tenant-id",
};

describe("buildDriblApiUrl", () => {
  it("builds a URL with season/competition/league/tenant/timezone params", () => {
    const url = buildDriblApiUrl("fixtures", ids);

    expect(url).toBe(
      "https://mc-api.dribl.com/api/fixtures?season=season-id&competition=competition-id&league=league-id&tenant=tenant-id&timezone=Australia%2FMelbourne",
    );
  });

  it("includes extra params after the base ones", () => {
    const url = buildDriblApiUrl("fixtures", ids, { round: "3" });

    expect(url).toContain("round=3");
  });
});
