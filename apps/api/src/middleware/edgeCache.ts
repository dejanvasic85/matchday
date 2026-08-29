// Response caching for read routes. Runs AFTER apiTokenAuthMiddleware, so a cache hit still
// costs a token check — only the Neon round-trip is skipped.

import type { Context, MiddlewareHandler, Next } from "hono";

/** Seconds a resource stays cached, from its crawl cadence: the catalog crawl is weekly,
 * the deep crawl (fixtures/tables) hourly during match windows. */
export const cacheTtlValue = {
  catalog: 3600,
  matchData: 300,
} as const;

const cacheableStatus = 200;

/** `public` on the stored copy so the Cache API will accept it, `private` on the one sent back.
 * Returning `public` would let Cloudflare's CDN serve this URL without invoking the Worker — and
 * since the cache key excludes the Authorization header, that would answer unauthenticated
 * requests from cache. */
function cacheableCopy(response: Response, ttlSeconds: number): Response {
  const copy = new Response(response.body, response);
  copy.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
  return copy;
}

function cacheKey(c: Context): Request {
  return new Request(c.req.url, { method: "GET" });
}

/**
 * Serves this route from the Worker cache when warm, else runs the handler and stores the result.
 * GET-only, 200-only: an error must never be what the next caller reads.
 */
export function edgeCache(ttlSeconds: number): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    if (c.req.method !== "GET") {
      return next();
    }

    const cache = caches.default;
    const key = cacheKey(c);

    const hit = await cache.match(key);
    if (hit) {
      const response = new Response(hit.body, hit);
      response.headers.set("Cache-Control", `private, max-age=${ttlSeconds}`);
      response.headers.set("X-Cache", "HIT");
      return response;
    }

    await next();

    if (c.res.status !== cacheableStatus) {
      return;
    }

    c.executionCtx.waitUntil(cache.put(key, cacheableCopy(c.res.clone(), ttlSeconds)));
    c.res.headers.set("Cache-Control", `private, max-age=${ttlSeconds}`);
    c.res.headers.set("X-Cache", "MISS");
  };
}
