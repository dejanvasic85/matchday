import { listAllClubs, listAllCompetitions, listAllSeasons, listAllTeams } from "#catalogTasks.ts";
import { createMatchdayClient } from "#client.ts";

function makeClient(pages: { data: unknown[]; nextCursor: string | null }[]) {
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

describe("listAllClubs", () => {
  it("asks for the server's max page size so a full walk costs the fewest requests", async () => {
    const { client, urls } = makeClient([{ data: [], nextCursor: null }]);

    await listAllClubs(client);

    expect(urls[0]).toContain("limit=500");
  });

  it("concatenates every page into one list", async () => {
    const { client, urls } = makeClient([
      { data: [{ id: "clb_a" }], nextCursor: "Y3Vyc29yMQ" },
      { data: [{ id: "clb_b" }], nextCursor: null },
    ]);

    const result = await listAllClubs(client);

    expect(result).toEqual({ ok: true, value: [{ id: "clb_a" }, { id: "clb_b" }] });
    expect(urls[1]).toContain("cursor=Y3Vyc29yMQ");
  });

  it("honours a caller's limit over the default", async () => {
    const { client, urls } = makeClient([{ data: [], nextCursor: null }]);

    await listAllClubs(client, { limit: 50 });

    expect(urls[0]).toContain("limit=50");
  });
});

describe("listAllTeams", () => {
  it("filters by club server-side rather than walking the whole catalog", async () => {
    const { client, urls } = makeClient([{ data: [], nextCursor: null }]);

    await listAllTeams(client, { clubId: "clb_abc123" });

    expect(urls[0]).toContain("clubId=clb_abc123");
  });

  it("requests the unfiltered catalog when given no filter", async () => {
    const { client, urls } = makeClient([{ data: [], nextCursor: null }]);

    await listAllTeams(client);

    expect(urls[0]).not.toContain("clubId");
  });
});

describe("listAllCompetitions", () => {
  it("walks the competitions route", async () => {
    const { client, urls } = makeClient([{ data: [{ id: "cmp_a" }], nextCursor: null }]);

    const result = await listAllCompetitions(client);

    expect(urls[0]).toContain("/competitions?");
    expect(result).toEqual({ ok: true, value: [{ id: "cmp_a" }] });
  });
});

describe("listAllSeasons", () => {
  it("walks the seasons route", async () => {
    const { client, urls } = makeClient([{ data: [{ id: "sea_a" }], nextCursor: null }]);

    const result = await listAllSeasons(client);

    expect(urls[0]).toContain("/seasons?");
    expect(result).toEqual({ ok: true, value: [{ id: "sea_a" }] });
  });
});
