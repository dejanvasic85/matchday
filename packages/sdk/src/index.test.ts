import { createMatchdayClient } from "#index.ts";

describe("createMatchdayClient", () => {
  it("sends the bearer token and hits the configured base URL", async () => {
    const fetch = vi.fn(
      async (_request: Request) => new Response(JSON.stringify([]), { status: 200 }),
    );
    const client = createMatchdayClient({
      baseUrl: "https://api.matchday.example",
      apiToken: "test-token",
      fetch,
    });

    await client.GET("/clubs");

    expect(fetch).toHaveBeenCalledTimes(1);
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.url).toBe("https://api.matchday.example/clubs");
    expect(request?.headers.get("authorization")).toBe("Bearer test-token");
  });
});
