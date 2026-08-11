import { sendWebhook } from "#webhookSender.ts";

describe("sendWebhook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWebhook({
      url: "https://example.com/webhooks/matchday",
      body: '{"leagueId":"lea_abc123"}',
      signature: "deadbeef",
    });

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("posts the body with a signature header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await sendWebhook({
      url: "https://example.com/webhooks/matchday",
      body: '{"leagueId":"lea_abc123"}',
      signature: "deadbeef",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/webhooks/matchday",
      expect.objectContaining({
        method: "POST",
        body: '{"leagueId":"lea_abc123"}',
        headers: expect.objectContaining({ "x-matchday-signature": "sha256=deadbeef" }),
      }),
    );
  });

  it("returns err on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await sendWebhook({
      url: "https://example.com/webhooks/matchday",
      body: "{}",
      signature: "deadbeef",
    });

    assert(!result.ok);
    expect(result.error.message).toContain("HTTP 500");
  });

  it("returns err when the fetch call throws (e.g. timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("The operation was aborted due to timeout")),
    );

    const result = await sendWebhook({
      url: "https://example.com/webhooks/matchday",
      body: "{}",
      signature: "deadbeef",
    });

    assert(!result.ok);
  });
});
