// Scheduling decision + dispatch, wired together. Pure apart from the injected `dispatch` and
// `logger`, so the whole thing is unit-testable without a Worker runtime or a network call.

import { ok, type Logger, type Result } from "@matchday/domain";
import type { CrawlDecision } from "#crawlWindow.ts";

export type DispatchFn = (workflow: string) => Promise<Result<void>>;

/** One workflow and the rule that decides which ticks it belongs to. */
export type CrawlSchedule = {
  workflow: string;
  decide: (instant: Date) => CrawlDecision;
};

export type RunCrawlScheduleInput = {
  dispatch: DispatchFn;
  logger: Logger;
  /** The tick this run is for — Cloudflare hands it to us as `event.scheduledTime`. */
  now: Date;
  schedules: readonly CrawlSchedule[];
};

export type ScheduleOutcome = {
  workflow: string;
  dispatched: boolean;
  localHour: number;
  localWeekday: string;
};

/**
 * Decide which of the configured crawls this hourly tick belongs to and dispatch those.
 *
 * Outside a window this is a deliberate no-op that still logs — a scheduler that goes silent is
 * indistinguishable from one that is broken, which is exactly the failure mode we are replacing.
 *
 * Every schedule is attempted even if an earlier one fails, so a broken catalog dispatch never
 * costs us a game-evening league crawl. The first failure is returned once they have all run.
 */
export async function runCrawlSchedule(
  input: RunCrawlScheduleInput,
): Promise<Result<ScheduleOutcome[]>> {
  const { dispatch, logger, now, schedules } = input;
  const outcomes: ScheduleOutcome[] = [];
  let firstFailure: Result<never> | undefined;

  for (const schedule of schedules) {
    const { workflow } = schedule;
    const decision = schedule.decide(now);
    const context = {
      workflow,
      localHour: decision.localHour,
      localWeekday: decision.localWeekday,
    };

    if (!decision.shouldCrawl) {
      logger.debug("scheduler.skipped", "outside a crawl window, not dispatching", context);
      outcomes.push({ ...context, dispatched: false });
      continue;
    }

    const dispatched = await dispatch(workflow);
    if (!dispatched.ok) {
      logger.error("scheduler.dispatchfailed", dispatched.error.message, {
        ...context,
        cause: dispatched.error.cause,
      });
      outcomes.push({ ...context, dispatched: false });
      firstFailure ??= dispatched;
      continue;
    }

    logger.info("scheduler.dispatched", "dispatched crawl workflow", context);
    outcomes.push({ ...context, dispatched: true });
  }

  return firstFailure ?? ok(outcomes);
}
