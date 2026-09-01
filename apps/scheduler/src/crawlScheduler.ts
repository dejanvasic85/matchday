// Reconcile every crawl against its own run history, then dispatch the ones that are due. Pure
// apart from the injected `dispatch`, `listRuns` and `logger`, so the whole thing is unit-testable
// without a Worker runtime or a network call.

import { ok, type Logger, type Result } from "@matchday/domain";
import { decideDispatch, type DispatchReason } from "#crawlReconciler.ts";
import type { WindowDecision } from "#crawlWindow.ts";
import type { WorkflowRunSummary } from "#workflowRuns.ts";

export type DispatchFn = (workflow: string) => Promise<Result<void>>;
export type ListRunsFn = (workflow: string) => Promise<Result<WorkflowRunSummary[]>>;

/** One workflow, the ticks it is eligible on, and how often it should actually run. */
export type CrawlSchedule = {
  workflow: string;
  isInWindow: (instant: Date) => WindowDecision;
  minIntervalMs: number;
};

export type RunCrawlScheduleInput = {
  dispatch: DispatchFn;
  listRuns: ListRunsFn;
  logger: Logger;
  /** The tick this run is for — Cloudflare hands it to us as `event.scheduledTime`. */
  now: Date;
  schedules: readonly CrawlSchedule[];
};

export type ScheduleOutcome = {
  workflow: string;
  dispatched: boolean;
  reason: DispatchReason | "lookup-failed";
  localHour: number;
  localWeekday: string;
};

/**
 * Decide which crawls this tick owes and dispatch those.
 *
 * A tick that dispatches nothing still logs why — a scheduler that goes silent is
 * indistinguishable from one that is broken, which is exactly the failure mode we are replacing.
 *
 * Every schedule is attempted even if an earlier one fails, so a broken catalog dispatch never
 * costs us a game-evening league crawl. The first failure is returned once they have all run.
 */
export async function runCrawlSchedule(
  input: RunCrawlScheduleInput,
): Promise<Result<ScheduleOutcome[]>> {
  const { dispatch, listRuns, logger, now, schedules } = input;
  const outcomes: ScheduleOutcome[] = [];
  let firstFailure: Result<never> | undefined;

  for (const schedule of schedules) {
    const { workflow, minIntervalMs } = schedule;
    const window = schedule.isInWindow(now);
    const context = {
      workflow,
      localHour: window.localHour,
      localWeekday: window.localWeekday,
    };

    // Outside the window there is nothing to reconcile, so this costs no GitHub call at all —
    // which is most ticks.
    if (!window.inWindow) {
      logger.debug("scheduler.skipped", "outside the crawl window", {
        ...context,
        reason: "outside-window",
      });
      outcomes.push({ ...context, dispatched: false, reason: "outside-window" });
      continue;
    }

    const runs = await listRuns(workflow);
    if (!runs.ok) {
      logger.error("scheduler.lookupfailed", runs.error.message, {
        ...context,
        cause: runs.error.cause,
      });
      outcomes.push({ ...context, dispatched: false, reason: "lookup-failed" });
      firstFailure ??= runs;
      continue;
    }

    const decision = decideDispatch({ now, inWindow: true, minIntervalMs, runs: runs.value });
    if (!decision.dispatch) {
      logger.debug("scheduler.skipped", "no crawl due on this tick", {
        ...context,
        reason: decision.reason,
        lastRunAt: decision.lastRunAt?.toISOString(),
      });
      outcomes.push({ ...context, dispatched: false, reason: decision.reason });
      continue;
    }

    const dispatched = await dispatch(workflow);
    if (!dispatched.ok) {
      logger.error("scheduler.dispatchfailed", dispatched.error.message, {
        ...context,
        cause: dispatched.error.cause,
      });
      outcomes.push({ ...context, dispatched: false, reason: decision.reason });
      firstFailure ??= dispatched;
      continue;
    }

    logger.info("scheduler.dispatched", "dispatched crawl workflow", {
      ...context,
      lastRunAt: decision.lastRunAt?.toISOString(),
    });
    outcomes.push({ ...context, dispatched: true, reason: decision.reason });
  }

  return firstFailure ?? ok(outcomes);
}
