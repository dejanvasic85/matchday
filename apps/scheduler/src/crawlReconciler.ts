// Does this crawl need to run again? Pure: the caller supplies the tick, the window answer and
// the workflow's recent runs, and gets back a decision plus the reason for it.
//
// This is what makes a dropped tick cheap. The scheduler holds no state of its own — GitHub's run
// history is the state — so the next tick simply sees the run never happened and dispatches it.

import type { WorkflowRunSummary } from "#workflowRuns.ts";

/** Why a tick did or did not dispatch. Logged verbatim, so a quiet scheduler still explains itself. */
export type DispatchReason = "due" | "outside-window" | "run-active" | "ran-recently";

export type DispatchDecision = {
  dispatch: boolean;
  reason: DispatchReason;
  /** When the workflow last started, if it ever has — logged so a skip is self-explanatory. */
  lastRunAt?: Date;
};

export type DecideDispatchInput = {
  now: Date;
  inWindow: boolean;
  /** How long after a run starts the next one becomes due. */
  minIntervalMs: number;
  /** The workflow's most recent runs, in any order. */
  runs: readonly WorkflowRunSummary[];
};

function newestRunAt(runs: readonly WorkflowRunSummary[]): Date | undefined {
  let newest: Date | undefined;
  for (const run of runs) {
    if (newest === undefined || run.createdAt > newest) {
      newest = run.createdAt;
    }
  }
  return newest;
}

/**
 * Dispatch when the tick is inside the window, nothing is already running, and enough time has
 * passed since the last run started.
 *
 * A queued or in-progress run blocks a dispatch outright: the workflows serialise on a concurrency
 * group, so a second dispatch would only pile up behind the first and crawl the same data twice.
 */
export function decideDispatch(input: DecideDispatchInput): DispatchDecision {
  const { now, inWindow, minIntervalMs, runs } = input;

  if (!inWindow) {
    return { dispatch: false, reason: "outside-window" };
  }

  if (runs.some((run) => run.active)) {
    return { dispatch: false, reason: "run-active", lastRunAt: newestRunAt(runs) };
  }

  const lastRunAt = newestRunAt(runs);
  if (lastRunAt !== undefined && now.getTime() - lastRunAt.getTime() < minIntervalMs) {
    return { dispatch: false, reason: "ran-recently", lastRunAt };
  }

  return { dispatch: true, reason: "due", lastRunAt };
}
