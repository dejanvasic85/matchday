import createClient from "openapi-fetch";
import type { Client, ClientOptions } from "openapi-fetch";
import type { paths } from "#generated/schema.d.ts";

export type { components, paths } from "#generated/schema.d.ts";

export type MatchdayClientOptions = {
  /** The matchday API's base URL, e.g. "https://api.matchday.example". */
  baseUrl: string;
  /** A per-client API token issued via `mday api-token-create` (ADR 0013). */
  apiToken: string;
  /** Override the underlying fetch implementation (defaults to `globalThis.fetch`). Mainly for tests. */
  fetch?: ClientOptions["fetch"];
};

export type MatchdayClient = Client<paths>;

/** Typed client for the matchday API — every protected route requires the bearer token this
 * pre-sets (ADR 0013), so consumers never hand-roll the Authorization header. */
export function createMatchdayClient(options: MatchdayClientOptions): MatchdayClient {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers: { Authorization: `Bearer ${options.apiToken}` },
    fetch: options.fetch,
  });
}
