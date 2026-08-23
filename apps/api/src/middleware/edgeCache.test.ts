import { Hono } from "hono";
import { cacheTtlValue, edgeCache } from "#middleware/edgeCache.ts";

type CacheStub = { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

function stubCaches(hit?: Response): CacheStub {
  const cache: CacheStub = {
    match: vi.fn().mockResolvedValue(hit),
    put: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal("caches", { default: cache });
  return cache;
}

function makeApp(handler: () => Response, ttl = cacheTtlValue.catalog) {
  const app = new Hono();
  app.use("*", edgeCache(ttl));
  app.all("/clubs", () => handler());
  return app;
}

const executionCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("edgeCache", () => {
  it("stores a 200 and reports a miss", async () => {
    const cache = stubCaches();
    const app = makeApp(() => new Response('{"ok":true}', { status: 200 }));

    const res = await app.request("/clubs", {}, {}, executionCtx);

    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(cache.put).toHaveBeenCalled();
  });

  it("serves a warm entry without running the handler", async () => {
    const handler = vi.fn(() => new Response('{"ok":true}', { status: 200 }));
    stubCaches(new Response('{"cached":true}', { status: 200 }));
    const app = makeApp(handler);

    const res = await app.request("/clubs", {}, {}, executionCtx);

    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(await res.text()).toBe('{"cached":true}');
    expect(handler).not.toHaveBeenCalled();
  });

  it("never sends Cache-Control: public to the client", async () => {
    stubCaches();
    const app = makeApp(() => new Response("{}", { status: 200 }));

    const res = await app.request("/clubs", {}, {}, executionCtx);

    // `public` would let Cloudflare's CDN answer this URL without invoking the Worker, and the
    // cache key excludes the Authorization header — that would serve authed data unauthenticated.
    expect(res.headers.get("Cache-Control")).toBe(`private, max-age=${cacheTtlValue.catalog}`);
    expect(res.headers.get("Cache-Control")).not.toContain("public");
  });

  it("stores the copy as public so the Cache API accepts it", async () => {
    const cache = stubCaches();
    const app = makeApp(() => new Response("{}", { status: 200 }));

    await app.request("/clubs", {}, {}, executionCtx);

    const stored: Response = cache.put.mock.calls[0][1];
    expect(stored.headers.get("Cache-Control")).toBe(`public, max-age=${cacheTtlValue.catalog}`);
  });

  it("does not cache a non-200", async () => {
    const cache = stubCaches();
    const app = makeApp(() => new Response('{"error":"nope"}', { status: 500 }));

    const res = await app.request("/clubs", {}, {}, executionCtx);

    expect(res.status).toBe(500);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("does not cache a non-GET", async () => {
    const cache = stubCaches();
    const app = makeApp(() => new Response("{}", { status: 200 }));

    await app.request("/clubs", { method: "POST" }, {}, executionCtx);

    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("gives match data a shorter TTL than catalog data", () => {
    expect(cacheTtlValue.matchData).toBeLessThan(cacheTtlValue.catalog);
  });
});
