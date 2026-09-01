// The Worker entry point: transport glue only (AGENTS.md). Cloudflare wakes this hourly; which
// crawls that tick belongs to is decided in `crawlWindow.ts`, and the dispatch itself lives in
// `workflowDispatcher.ts`.
//
// This exists because GitHub's own `schedule` trigger is best-effort: it delays runs by minutes
// to hours and drops most of them outright. `workflow_dispatch` is not best-effort, so we keep
// the workflows and drive them from a scheduler that actually fires.

import { createConsoleLogger } from "@matchday/domain";
import { getSchedulerConfig, type SchedulerBindings } from "#config.ts";
import { runCrawlSchedule, type CrawlSchedule } from "#crawlScheduler.ts";
import { decideCatalogCrawl, decideLeagueCrawl } from "#crawlWindow.ts";
import { dispatchWorkflow } from "#workflowDispatcher.ts";

/** The crawls this scheduler drives, each with the rule for which ticks it belongs to. Both are
 * dispatch-only workflows: GitHub's own `schedule` trigger is too unreliable to drive either. */
const crawlScheduleValue: readonly CrawlSchedule[] = [
  { workflow: "crawl-leagues.yml", decide: decideLeagueCrawl },
  { workflow: "crawl-catalog.yml", decide: decideCatalogCrawl },
];

export default {
  async scheduled(event: ScheduledController, env: SchedulerBindings): Promise<void> {
    const config = getSchedulerConfig(env);
    const logger = createConsoleLogger();

    const result = await runCrawlSchedule({
      dispatch: (workflow) =>
        dispatchWorkflow(fetch, {
          owner: config.GITHUB_OWNER,
          repo: config.GITHUB_REPO,
          workflow,
          ref: config.GITHUB_REF,
          token: config.GITHUB_TOKEN,
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
