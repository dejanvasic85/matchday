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

// Only the fields the reconciler reads. GitHub sends far more; the rest is none of our business.
const workflowRunsResponseSchema = z.object({
  workflow_runs: z.array(
    z.object({
      // Absent on runs started before a `run-name` was added, and on some GitHub responses.
      display_title: z.string().optional(),
      created_at: z.iso.datetime(),
      status: z.string(),
    }),
  ),
});

/** Fetch a deeper page than the caller needs when filtering by run name: the other source's runs
 * interleave in the list and would otherwise hide this source's newest ones. */
const runLookupPageSize = 20;

/** How to tell one source's runs from another's, by the `run-name` the workflow sets. */
export type RunNameFilter = {
  /** Keep runs whose name ends with this, e.g. `(coastal)`. */
  suffix: string;
  /** Also keep runs with no `(source)` tag at all. Set for the source that predates run tagging,
   * so its older, untagged runs are still reconciled during the transition. */
  includeUntagged?: boolean;
};

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
  /** Keep only this source's runs. Sources sharing a workflow tag their runs with `run-name`, so
   * each reconciles against its own history. */
  runNameFilter?: RunNameFilter;
};

/** Workflow names never end with `)`, so an untagged run is one without a `(source)` suffix. */
function matchesRunName(title: string, filter: RunNameFilter | undefined): boolean {
  if (filter === undefined) {
    return true;
  }
  return title.endsWith(filter.suffix) || (filter.includeUntagged === true && !title.endsWith(")"));
}

/**
 * Read a workflow's most recent runs, newest first. Returns a `Result` rather than throwing, so a
 * GitHub outage degrades one schedule's decision instead of failing the whole tick.
 */
export async function fetchRecentRuns(
  fetchImpl: FetchLike,
  input: FetchRecentRunsInput,
): Promise<Result<WorkflowRunSummary[]>> {
  const { owner, repo, workflow, token, limit, runNameFilter } = input;
  const perPage = runNameFilter === undefined ? limit : Math.max(limit, runLookupPageSize);
  const url = `${githubApiBaseUrl}/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=${perPage}`;

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
      parsed.data.workflow_runs
        .filter((run) => matchesRunName(run.display_title ?? "", runNameFilter))
        .slice(0, limit)
        .map((run) => ({
          createdAt: new Date(run.created_at),
          active: activeRunStatusValue.includes(run.status),
        })),
    );
  } catch (cause) {
    return serverError(`Run lookup for ${workflow} failed`, cause);
  }
}
