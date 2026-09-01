// The shape every GitHub REST call this Worker makes shares: base URL, headers and timeout.
// One place, so the dispatch and the run lookup cannot drift apart.

export const githubApiBaseUrl = "https://api.github.com";
export const githubRequestTimeoutMs = 10000;

const githubApiVersion = "2022-11-28";
// GitHub rejects requests without a User-Agent.
const userAgentValue = "matchday-scheduler";

/** Injected so tests assert on the request without a real network call. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** `body` adds the JSON content type; a GET has no body and does not need it. */
export function githubHeaders(token: string, body: "json" | "none"): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    ...(body === "json" ? { "content-type": "application/json" } : {}),
    "user-agent": userAgentValue,
    "x-github-api-version": githubApiVersion,
  };
}
