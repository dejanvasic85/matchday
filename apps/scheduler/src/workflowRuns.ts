// The scheduler's memory. It stores nothing itself: what GitHub already ran is the state, read
// back each tick, which is what lets a dropped tick heal on the next one.

import { ok, serverError, type Result } from "@matchday/domain";
import { z } from "zod";
import {
  githubApiBaseUrl,
  githubHeaders,
  githubRequestTimeoutMs,
  type FetchLike,
} from "#githubApi.ts";

/** GitHub statuses that mean a run has not finished. Anything else is done, one way or another. */
const activeRunStatusValue = ["queued", "in_progress", "waiting", "pending", "requested"];

// Only the two fields the reconciler reads. GitHub sends far more; the rest is none of our business.
const workflowRunsResponseSchema = z.object({
  workflow_runs: z.array(
    z.object({
      created_at: z.iso.datetime(),
      status: z.string(),
    }),
  ),
});

export type WorkflowRunSummary = {
  createdAt: Date;
  /** Queued or running — dispatching again now would only pile up behind it. */
  active: boolean;
};

export type FetchRecentRunsInput = {
  owner: string;
  repo: string;
  /** Workflow file name, e.g. `crawl-leagues.yml`. */
  workflow: string;
  token: string;
  /** How many of the most recent runs to read, newest first. */
  limit: number;
};

/**
 * Read a workflow's most recent runs, newest first. Returns a `Result` rather than throwing, so a
 * GitHub outage degrades one schedule's decision instead of failing the whole tick.
 */
export async function fetchRecentRuns(
  fetchImpl: FetchLike,
  input: FetchRecentRunsInput,
): Promise<Result<WorkflowRunSummary[]>> {
  const { owner, repo, workflow, token, limit } = input;
  const url = `${githubApiBaseUrl}/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=${limit}`;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: githubHeaders(token, "none"),
      signal: AbortSignal.timeout(githubRequestTimeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return serverError(
        `Run lookup for ${workflow} failed: HTTP ${response.status}${body === "" ? "" : ` — ${body}`}`,
      );
    }

    const parsed = workflowRunsResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return serverError(`Run lookup for ${workflow} returned an unexpected body`, parsed.error);
    }

    return ok(
      parsed.data.workflow_runs.map((run) => ({
        createdAt: new Date(run.created_at),
        active: activeRunStatusValue.includes(run.status),
      })),
    );
  } catch (cause) {
    return serverError(`Run lookup for ${workflow} failed`, cause);
  }
}
