// GitHub workflow dispatch: the one side-effecting call this Worker makes. Returns a `Result`
// rather than throwing (AGENTS.md), so the scheduled handler can log a failure without the
// Worker runtime treating it as an unhandled rejection.

import { ok, serverError, type Result } from "@matchday/domain";
import {
  githubApiBaseUrl,
  githubHeaders,
  githubRequestTimeoutMs,
  type FetchLike,
} from "#githubApi.ts";

export type DispatchWorkflowInput = {
  owner: string;
  repo: string;
  /** Workflow file name, e.g. `crawl-leagues.yml`. */
  workflow: string;
  /** Git ref to run the workflow from — must be a branch GitHub holds the workflow on. */
  ref: string;
  token: string;
};

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
      headers: githubHeaders(token, "json"),
      body: JSON.stringify({ ref }),
      signal: AbortSignal.timeout(githubRequestTimeoutMs),
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
