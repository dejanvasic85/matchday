import createClient from "openapi-fetch";
import type { Client, ClientOptions } from "openapi-fetch";
import type { paths } from "#generated/schema.d.ts";
import { createRetryFetch } from "#retryFetch.ts";

/** Defaults, not ceilings: a caller on a slow link raises `timeoutMs`, and a build doing hundreds
 * of calls may want `retries: 0` to fail fast instead of stretching a broken run. */
export const clientDefaultValue = {
  timeoutMs: 30_000,
  retries: 2,
  retryDelayMs: 250,
} as const;

export type MatchdayClientOptions = {
  /** The matchday API's base URL, e.g. "https://api.matchday.example". */
  baseUrl: string;
  /** A per-client API token issued via `mday api-token-create`. */
  apiToken: string;
  /** Abort a request after this long. Defaults to 30s. */
  timeoutMs?: number;
  /** Extra attempts for idempotent requests on 5xx or a failed request. Defaults to 2. */
  retries?: number;
  /** Base delay between retries; grows linearly per attempt. Defaults to 250ms. */
  retryDelayMs?: number;
  /** Override the underlying fetch implementation (defaults to `globalThis.fetch`). Mainly for tests. */
  fetch?: ClientOptions["fetch"];
};

export type MatchdayClient = Client<paths>;

/** Typed client for the matchday API — every protected route requires the bearer token this
 * pre-sets, so consumers never hand-roll the Authorization header. */
export function createMatchdayClient(options: MatchdayClientOptions): MatchdayClient {
  const {
    baseUrl,
    apiToken,
    timeoutMs = clientDefaultValue.timeoutMs,
    retries = clientDefaultValue.retries,
    retryDelayMs = clientDefaultValue.retryDelayMs,
    fetch: baseFetch,
  } = options;

  return createClient<paths>({
    baseUrl,
    headers: { Authorization: `Bearer ${apiToken}` },
    fetch: createRetryFetch({
      fetch: baseFetch ?? globalThis.fetch,
      timeoutMs,
      retries,
      retryDelayMs,
    }),
  });
}
