import { createMatchdayClient } from "#client.ts";
import { getClubLeagues, getLeagueOverview, getLeagueTeams } from "#leagueTasks.ts";

function makeClient(body: unknown, status = 200) {
  const fetch = vi.fn(async (_request: Request) => new Response(JSON.stringify(body), { status }));
  const client = createMatchdayClient({
    baseUrl: "https://api.matchday.example",
    apiToken: "test-token",
    retries: 0,
    fetch,
  });
  return { client, fetch };
}

describe("getLeagueOverview", () => {
  it("requests the overview route for the given league", async () => {
    const { client, fetch } = makeClient({ id: "lea_abc123", fixtures: [], table: [], teams: [] });

    const result = await getLeagueOverview(client, "lea_abc123");

    expect(fetch.mock.calls[0]?.[0]?.url).toBe(
      "https://api.matchday.example/leagues/lea_abc123/overview",
    );
    expect(result).toEqual(expect.objectContaining({ ok: true }));
  });

  it("returns an err Result rather than throwing on a 404", async () => {
    const { client } = makeClient({ error: "League not found" }, 404);

    const result = await getLeagueOverview(client, "lea_missing0000");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ status: 404, message: "League not found" }),
    });
  });
});

describe("getLeagueTeams", () => {
  it("requests the league-scoped teams route, not the full catalog", async () => {
    const { client, fetch } = makeClient([]);

    await getLeagueTeams(client, "lea_abc123");

    const { url } = fetch.mock.calls[0]?.[0] ?? {};
    expect(url).toBe("https://api.matchday.example/leagues/lea_abc123/teams");
    expect(url).not.toContain("/teams?");
  });
});

describe("getClubLeagues", () => {
  it("filters leagues by clubId server-side", async () => {
    const { client, fetch } = makeClient([]);

    await getClubLeagues(client, "clb_abc123");

    expect(fetch.mock.calls[0]?.[0]?.url).toBe(
      "https://api.matchday.example/leagues?clubId=clb_abc123",
    );
  });
});
