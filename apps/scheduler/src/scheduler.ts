// The Worker entry point: transport glue only (AGENTS.md). Cloudflare wakes this every 15 minutes;
// which crawls that tick owes is reconciled in `crawlScheduler.ts`, and the GitHub calls live in
// `workflowDispatcher.ts` and `workflowRuns.ts`.
//
// This exists because GitHub's own `schedule` trigger is best-effort: it delays runs by minutes
// to hours and drops most of them outright. `workflow_dispatch` is not best-effort, so we keep
// the workflows and drive them from a scheduler that actually fires.

import { createConsoleLogger } from "@matchday/domain";
import { getSchedulerConfig, type SchedulerBindings } from "#config.ts";
import { runCrawlSchedule, type CrawlSchedule } from "#crawlScheduler.ts";
import { isInCatalogWindow, isInLeagueWindow } from "#crawlWindow.ts";
import { dispatchWorkflow } from "#workflowDispatcher.ts";
import { fetchRecentRuns } from "#workflowRuns.ts";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

// A run every 15 minutes gives four chances to catch each of these, so one dropped tick costs
// minutes rather than a whole interval.
const leagueMinIntervalMs = 55 * minuteMs;
const catalogMinIntervalMs = 6 * dayMs;

// Two runs is enough to see an in-flight run and the last completed one.
const runLookupLimit = 2;

/** The crawls this scheduler drives: when each is eligible, and how often it should actually run. */
const crawlScheduleValue: readonly CrawlSchedule[] = [
  {
    workflow: "crawl-leagues.yml",
    isInWindow: isInLeagueWindow,
    minIntervalMs: leagueMinIntervalMs,
  },
  {
    workflow: "crawl-catalog.yml",
    isInWindow: isInCatalogWindow,
    minIntervalMs: catalogMinIntervalMs,
  },
];

export default {
  async scheduled(event: ScheduledController, env: SchedulerBindings): Promise<void> {
    const config = getSchedulerConfig(env);
    const logger = createConsoleLogger();
    const githubRepoValue = {
      owner: config.GITHUB_OWNER,
      repo: config.GITHUB_REPO,
      token: config.GITHUB_TOKEN,
    };

    const result = await runCrawlSchedule({
      dispatch: (workflow) =>
        dispatchWorkflow(fetch, { ...githubRepoValue, workflow, ref: config.GITHUB_REF }),
      listRuns: (workflow) =>
        fetchRecentRuns(fetch, { ...githubRepoValue, workflow, limit: runLookupLimit }),
      logger,
      now: new Date(event.scheduledTime),
      schedules: crawlScheduleValue,
    });

    // Throw at the transport boundary so Cloudflare records the invocation as failed and it shows
    // up in Workers Logs — the service itself never throws.
    if (!result.ok) {
      throw new Error(result.error.message, { cause: result.error.cause });
    }
  },
};
