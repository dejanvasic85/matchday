import { createRetryFetch } from "#retryFetch.ts";

const noSleep = () => Promise.resolve();

function makeFetch(responses: (Response | Error)[]) {
  const calls: Request[] = [];
  const fetch = vi.fn(async (request: Request) => {
    calls.push(request);
    const next = responses.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next ?? new Response(null, { status: 200 });
  });
  return { fetch, calls };
}

describe("createRetryFetch", () => {
  it("returns a 200 without retrying", async () => {
    const { fetch } = makeFetch([new Response(null, { status: 200 })]);
    const retryFetch = createRetryFetch({ fetch, timeoutMs: 100, retries: 2, retryDelayMs: 0 });

    const response = await retryFetch(new Request("https://example.test/clubs"));

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a 5xx and returns the eventual success", async () => {
    const { fetch } = makeFetch([
      new Response(null, { status: 503 }),
      new Response(null, { status: 200 }),
    ]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    const response = await retryFetch(new Request("https://example.test/clubs"));

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never retries a 4xx — the request is wrong and will stay wrong", async () => {
    const { fetch } = makeFetch([new Response(null, { status: 404 })]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    const response = await retryFetch(new Request("https://example.test/clubs"));

    expect(response.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after the configured retries and returns the last 5xx", async () => {
    const { fetch } = makeFetch([
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
      new Response(null, { status: 500 }),
    ]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    const response = await retryFetch(new Request("https://example.test/clubs"));

    expect(response.status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-idempotent method", async () => {
    const { fetch } = makeFetch([
      new Response(null, { status: 500 }),
      new Response(null, { status: 200 }),
    ]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    const response = await retryFetch(
      new Request("https://example.test/clubs", { method: "POST" }),
    );

    expect(response.status).toBe(500);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries a thrown network failure", async () => {
    const { fetch } = makeFetch([new Error("ECONNRESET"), new Response(null, { status: 200 })]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    const response = await retryFetch(new Request("https://example.test/clubs"));

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rethrows when every attempt fails", async () => {
    const { fetch } = makeFetch([
      new Error("ECONNRESET"),
      new Error("ECONNRESET"),
      new Error("ECONNRESET"),
    ]);
    const retryFetch = createRetryFetch({
      fetch,
      timeoutMs: 100,
      retries: 2,
      retryDelayMs: 0,
      sleep: noSleep,
    });

    await expect(retryFetch(new Request("https://example.test/clubs"))).rejects.toThrow(
      "ECONNRESET",
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("attaches an abort signal so a hung request can't run forever", async () => {
    const { fetch, calls } = makeFetch([new Response(null, { status: 200 })]);
    const retryFetch = createRetryFetch({ fetch, timeoutMs: 100, retries: 0, retryDelayMs: 0 });

    await retryFetch(new Request("https://example.test/clubs"));

    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps the caller's own signal alongside the timeout", async () => {
    const { fetch, calls } = makeFetch([new Response(null, { status: 200 })]);
    const retryFetch = createRetryFetch({ fetch, timeoutMs: 1000, retries: 0, retryDelayMs: 0 });
    const controller = new AbortController();

    await retryFetch(new Request("https://example.test/clubs", { signal: controller.signal }));
    controller.abort();

    expect(calls[0]?.signal?.aborted).toBe(true);
  });
});
