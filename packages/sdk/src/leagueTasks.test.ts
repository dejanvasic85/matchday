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

function makePagingClient(pages: { data: unknown[]; nextCursor: string | null }[]) {
  const urls: string[] = [];
  const fetch = vi.fn(async (request: Request) => {
    urls.push(request.url);
    return new Response(JSON.stringify(pages.shift()), { status: 200 });
  });
  const client = createMatchdayClient({
    baseUrl: "https://api.matchday.example",
    apiToken: "test-token",
    retries: 0,
    fetch,
  });
  return { client, urls };
}

describe("getClubLeagues", () => {
  it("filters leagues by clubId server-side", async () => {
    const { client, urls } = makePagingClient([{ data: [], nextCursor: null }]);

    await getClubLeagues(client, "clb_abc123");

    expect(urls[0]).toContain("clubId=clb_abc123");
  });

  it("stops after one request when the first page is the last", async () => {
    const { client, urls } = makePagingClient([{ data: [{ id: "lea_a" }], nextCursor: null }]);

    const result = await getClubLeagues(client, "clb_abc123");

    expect(urls).toHaveLength(1);
    expect(result).toEqual({ ok: true, value: [{ id: "lea_a" }] });
  });

  it("follows nextCursor so 'every league' isn't just the first page", async () => {
    const { client, urls } = makePagingClient([
      { data: [{ id: "lea_a" }], nextCursor: "Y3Vyc29yMQ" },
      { data: [{ id: "lea_b" }], nextCursor: "Y3Vyc29yMg" },
      { data: [{ id: "lea_c" }], nextCursor: null },
    ]);

    const result = await getClubLeagues(client, "clb_abc123");

    expect(result).toEqual({
      ok: true,
      value: [{ id: "lea_a" }, { id: "lea_b" }, { id: "lea_c" }],
    });
    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain("cursor=Y3Vyc29yMQ");
    expect(urls[2]).toContain("cursor=Y3Vyc29yMg");
  });

  it("returns the failure instead of a partial list when a later page fails", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "lea_a" }], nextCursor: "Y3Vyc29yMQ" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Invalid cursor" }), { status: 400 }),
      );
    const client = createMatchdayClient({
      baseUrl: "https://api.matchday.example",
      apiToken: "test-token",
      retries: 0,
      fetch,
    });

    const result = await getClubLeagues(client, "clb_abc123");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ status: 400, message: "Invalid cursor" }),
    });
  });
});
