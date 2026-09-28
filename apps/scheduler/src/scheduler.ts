// The Worker entry point: transport glue only (AGENTS.md). Cloudflare wakes this every 15 minutes;
// which crawls that tick owes is reconciled in `crawlScheduler.ts`, and the GitHub calls live in
// `workflowDispatcher.ts` and `workflowRuns.ts`.
//
// This exists because GitHub's own `schedule` trigger is best-effort: it delays runs by minutes
// to hours and drops most of them outright. `workflow_dispatch` is not best-effort, so we keep
// the workflows and drive them from a scheduler that actually fires.

import { createConsoleLogger, sourceValue } from "@matchday/domain";
import { getSchedulerConfig, type SchedulerBindings } from "#config.ts";
import { runCrawlSchedule, type CrawlSchedule, type DispatchInputs } from "#crawlScheduler.ts";
import {
  coastalLeagueMinIntervalMs,
  isInCatalogWindow,
  isInCoastalCatalogWindow,
  isInCoastalLeagueWindow,
  isInLeagueWindow,
} from "#crawlWindow.ts";
import { dispatchWorkflow } from "#workflowDispatcher.ts";
import { fetchRecentRuns, type RunNameFilter } from "#workflowRuns.ts";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;

// A run every 15 minutes gives four chances to catch each of these, so one dropped tick costs
// minutes rather than a whole interval.
const leagueMinIntervalMs = 55 * minuteMs;
const catalogMinIntervalMs = 6 * dayMs;
// Coastal results come from the clock, so a daily run is plenty to publish the next season.
const coastalCatalogMinIntervalMs = 20 * hourMs;

// Two runs is enough to see an in-flight run and the last completed one.
const runLookupLimit = 2;

/** How to pick a source's runs out of the shared workflow history, by the `run-name` tag. Dribl
 * predates tagging, so its older runs have no tag and are matched too — otherwise the first
 * tick after deploy would miss an in-flight Dribl run and start a second one. */
function runNameFilterFor(inputs: DispatchInputs): RunNameFilter | undefined {
  const source = inputs.source;
  if (source === undefined) {
    return undefined;
  }
  return { suffix: `(${source})`, includeUntagged: source === sourceValue.dribl };
}

/** The crawls this scheduler drives: when each is eligible, and how often it should actually run.
 * One entry per source, so the two cadences never interfere through shared run history. */
const crawlScheduleValue: readonly CrawlSchedule[] = [
  {
    workflow: "crawl-leagues.yml",
    inputs: { source: sourceValue.dribl },
    isInWindow: isInLeagueWindow,
    minIntervalMs: () => leagueMinIntervalMs,
  },
  {
    workflow: "crawl-leagues.yml",
    inputs: { source: sourceValue.coastal },
    isInWindow: isInCoastalLeagueWindow,
    minIntervalMs: coastalLeagueMinIntervalMs,
  },
  {
    workflow: "crawl-catalog.yml",
    inputs: { source: sourceValue.dribl },
    isInWindow: isInCatalogWindow,
    minIntervalMs: () => catalogMinIntervalMs,
  },
  {
    workflow: "crawl-catalog.yml",
    inputs: { source: sourceValue.coastal },
    isInWindow: isInCoastalCatalogWindow,
    minIntervalMs: () => coastalCatalogMinIntervalMs,
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
      dispatch: (workflow, inputs) =>
        dispatchWorkflow(fetch, { ...githubRepoValue, workflow, ref: config.GITHUB_REF, inputs }),
      listRuns: (workflow, inputs) =>
        fetchRecentRuns(fetch, {
          ...githubRepoValue,
          workflow,
          limit: runLookupLimit,
          runNameFilter: runNameFilterFor(inputs),
        }),
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
