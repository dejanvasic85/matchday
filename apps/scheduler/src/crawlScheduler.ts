// Scheduling decision + dispatch, wired together. Pure apart from the injected `dispatch` and
// `logger`, so the whole thing is unit-testable without a Worker runtime or a network call.

import { ok, type Logger, type Result } from "@matchday/domain";
import { decideCrawl } from "#crawlWindow.ts";

export type DispatchFn = (workflow: string) => Promise<Result<void>>;

export type RunCrawlScheduleInput = {
  dispatch: DispatchFn;
  logger: Logger;
  /** The tick this run is for — Cloudflare hands it to us as `event.scheduledTime`. */
  now: Date;
  workflow: string;
};

export type ScheduleOutcome = {
  dispatched: boolean;
  localHour: number;
  localWeekday: string;
};

/**
 * Decide whether this hourly tick falls in a game window and, if so, dispatch the crawl.
 *
 * Outside a window this is a deliberate no-op that still logs — a scheduler that goes silent is
 * indistinguishable from one that is broken, which is exactly the failure mode we are replacing.
 */
export async function runCrawlSchedule(
  input: RunCrawlScheduleInput,
): Promise<Result<ScheduleOutcome>> {
  const { dispatch, logger, now, workflow } = input;
  const decision = decideCrawl(now);

  if (!decision.shouldCrawl) {
    logger.debug("scheduler.skipped", "outside a game window, not dispatching", {
      workflow,
      localHour: decision.localHour,
      localWeekday: decision.localWeekday,
    });
    return ok({
      dispatched: false,
      localHour: decision.localHour,
      localWeekday: decision.localWeekday,
    });
  }

  const dispatched = await dispatch(workflow);
  if (!dispatched.ok) {
    logger.error("scheduler.dispatchfailed", dispatched.error.message, {
      workflow,
      localHour: decision.localHour,
      cause: dispatched.error.cause,
    });
    return dispatched;
  }

  logger.info("scheduler.dispatched", "dispatched crawl workflow", {
    workflow,
    localHour: decision.localHour,
    localWeekday: decision.localWeekday,
  });
  return ok({
    dispatched: true,
    localHour: decision.localHour,
    localWeekday: decision.localWeekday,
  });
}
