// GitHub workflow dispatch: the one side-effecting call this Worker makes. Returns a `Result`
// rather than throwing (AGENTS.md), so the scheduled handler can log a failure without the
// Worker runtime treating it as an unhandled rejection.

import { ok, serverError, type Result } from "@matchday/domain";

const githubApiBaseUrl = "https://api.github.com";
const githubApiVersion = "2022-11-28";
// GitHub rejects requests without a User-Agent.
const userAgentValue = "matchday-scheduler";
const dispatchTimeoutMs = 10000;

export type DispatchWorkflowInput = {
  owner: string;
  repo: string;
  /** Workflow file name, e.g. `crawl-leagues.yml`. */
  workflow: string;
  /** Git ref to run the workflow from — must be a branch GitHub holds the workflow on. */
  ref: string;
  token: string;
};

/** Injected so tests assert on the request without a real network call. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Fire a `workflow_dispatch` for one workflow. GitHub answers 204 with an empty body on success;
 * anything else is surfaced with its status and body so a bad token or a renamed workflow file is
 * obvious in the logs rather than silently doing nothing.
 */
export async function dispatchWorkflow(
  fetchImpl: FetchLike,
  input: DispatchWorkflowInput,
): Promise<Result<void>> {
  const { owner, repo, workflow, ref, token } = input;
  const url = `${githubApiBaseUrl}/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": userAgentValue,
        "x-github-api-version": githubApiVersion,
      },
      body: JSON.stringify({ ref }),
      signal: AbortSignal.timeout(dispatchTimeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return serverError(
        `Workflow dispatch for ${workflow} failed: HTTP ${response.status}${body === "" ? "" : ` — ${body}`}`,
      );
    }
    return ok(undefined);
  } catch (cause) {
    return serverError(`Workflow dispatch for ${workflow} failed`, cause);
  }
}
