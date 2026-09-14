import { browserFetch, type FetchPage } from "#crawlers/dribl/browserFetch.ts";
import { fetchRetryConfigValue } from "#crawlers/dribl/constants.ts";

function makeFakePage(evaluate: FetchPage["evaluate"]): FetchPage {
  return { evaluate };
}

/** Backoff runs into the seconds, so timers are faked: start the call, drain every pending
 * timer, then await. */
async function runWithTimersDrained<T>(call: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return call;
}

describe("browserFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    const page = makeFakePage(async (fn) => fn("https://example.com"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{"data":[]}') }),
    );

    const result = await runWithTimersDrained(browserFetch(page, "https://example.com"));

    expect(result).toEqual({ ok: true, value: { data: [] } });
  });

  it("returns err when the underlying evaluate call keeps throwing", async () => {
    const evaluate = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://example.com"),
    );

    assert(!result.ok);
    expect(evaluate).toHaveBeenCalledTimes(fetchRetryConfigValue.maxAttempts);
  });

  it("retries a dropped connection and returns the body from a later attempt", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValueOnce(new Error("page.evaluate: fetch failed"))
      .mockResolvedValueOnce('{"data":[{"id":"fixture-1"}]}');

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/fixtures"),
    );

    expect(result).toEqual({ ok: true, value: { data: [{ id: "fixture-1" }] } });
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it("retries a 503 from Dribl", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 503 fetching https://mc-api.dribl.com/api/fixtures"))
      .mockResolvedValueOnce('{"data":[]}');

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/fixtures"),
    );

    expect(result).toEqual({ ok: true, value: { data: [] } });
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404, which Dribl will refuse just the same next time", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 404 fetching https://mc-api.dribl.com/api/nope"));

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/nope"),
    );

    assert(!result.ok);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 403, which needs a fresh Cloudflare clearance rather than another go", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValue(new Error("HTTP 403 fetching https://mc-api.dribl.com/api/fixtures"));

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/fixtures"),
    );

    assert(!result.ok);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("reads the status out of a message playwright has prefixed", async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValue(
        new Error("page.evaluate: Error: HTTP 404 fetching https://mc-api.dribl.com/api/nope"),
      );

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/nope"),
    );

    assert(!result.ok);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("does not retry a body that isn't JSON", async () => {
    const evaluate = vi.fn().mockResolvedValue("<html>Just a moment...</html>");

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/fixtures"),
    );

    assert(!result.ok);
    expect(result.error.message).toContain("Failed to parse the response");
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("reports the last cause in a form that survives JSON logging", async () => {
    const cause = Object.assign(new Error("page.evaluate: Target page closed"), { log: [] });
    const evaluate = vi.fn().mockRejectedValue(cause);

    const result = await runWithTimersDrained(
      browserFetch(makeFakePage(evaluate), "https://mc-api.dribl.com/api/fixtures"),
    );

    assert(!result.ok);
    const logged = JSON.parse(JSON.stringify(result.error.cause));
    expect(logged).toMatchObject({ message: "page.evaluate: Target page closed" });
  });
});
