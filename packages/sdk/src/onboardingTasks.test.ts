import { createMatchdayClient } from "#client.ts";
import { addLeagueCrawlTarget, followClub, unfollowClub } from "#onboardingTasks.ts";

function makeClient(response: Response) {
  const fetch = vi.fn(async (_request: Request) => response);
  const client = createMatchdayClient({
    baseUrl: "https://api.matchday.example",
    apiToken: "test-token",
    retries: 0,
    fetch,
  });
  return { client, fetch };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("followClub", () => {
  const follow = {
    clubId: "clb_abc123",
    webhookUrl: "https://hooks.example.com/matchday",
    webhookSecret: "whsec_abc",
  };

  it("posts the webhook URL to the club's follow route", async () => {
    const { client, fetch } = makeClient(jsonResponse(follow));

    await followClub(client, "clb_abc123", follow.webhookUrl);

    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.matchday.example/clubs/clb_abc123/follow");
    expect(await request?.json()).toEqual({ webhookUrl: follow.webhookUrl });
  });

  it("returns the follow with its secret", async () => {
    const { client } = makeClient(jsonResponse(follow));

    const result = await followClub(client, "clb_abc123", follow.webhookUrl);

    expect(result).toEqual({ ok: true, value: follow });
  });

  it.each([
    { status: 400, error: "Webhook URL must be https with a public hostname" },
    { status: 404, error: "Club not found" },
  ])("returns an err Result with status $status", async ({ status, error }) => {
    const { client } = makeClient(jsonResponse({ error }, status));

    const result = await followClub(client, "clb_abc123", "http://localhost/hook");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ status, message: error }),
    });
  });
});

describe("unfollowClub", () => {
  it("sends a DELETE to the club's follow route", async () => {
    const { client, fetch } = makeClient(new Response(null, { status: 204 }));

    await unfollowClub(client, "clb_abc123");

    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("DELETE");
    expect(request?.url).toBe("https://api.matchday.example/clubs/clb_abc123/follow");
  });

  it("returns ok with no value on a 204", async () => {
    const { client } = makeClient(new Response(null, { status: 204 }));

    const result = await unfollowClub(client, "clb_abc123");

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns an err Result on a 404", async () => {
    const { client } = makeClient(
      jsonResponse({ error: "The client doesn't follow this club" }, 404),
    );

    const result = await unfollowClub(client, "clb_abc123");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        status: 404,
        message: "The client doesn't follow this club",
      }),
    });
  });
});

describe("addLeagueCrawlTarget", () => {
  const target = {
    id: "crt_abc123",
    competitionId: "cmp_abc123",
    leagueName: "U13 YSL Boys - North-West",
    currentLeagueId: "lea_abc123",
  };

  it("sends a PUT to the league's crawl-target route", async () => {
    const { client, fetch } = makeClient(jsonResponse(target));

    await addLeagueCrawlTarget(client, "lea_abc123");

    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("PUT");
    expect(request?.url).toBe("https://api.matchday.example/leagues/lea_abc123/crawl-target");
  });

  it("returns the target, including a null currentLeagueId", async () => {
    const { client } = makeClient(jsonResponse({ ...target, currentLeagueId: null }));

    const result = await addLeagueCrawlTarget(client, "lea_abc123");

    expect(result).toEqual({ ok: true, value: { ...target, currentLeagueId: null } });
  });

  it("returns an err Result on a 404", async () => {
    const { client } = makeClient(jsonResponse({ error: "League not found" }, 404));

    const result = await addLeagueCrawlTarget(client, "lea_missing0000");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ status: 404, message: "League not found" }),
    });
  });
});
