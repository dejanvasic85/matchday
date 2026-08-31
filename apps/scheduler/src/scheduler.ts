// The Worker entry point: transport glue only (AGENTS.md). Cloudflare wakes this hourly; the
// decision of whether that tick is inside a game window lives in `crawlWindow.ts`, and the
// dispatch itself in `workflowDispatcher.ts`.
//
// This exists because GitHub's own `schedule` trigger is best-effort: it delays runs by minutes
// to hours and drops most of them outright. `workflow_dispatch` is not best-effort, so we keep
// the workflows and drive them from a scheduler that actually fires.

import { createConsoleLogger } from "@matchday/domain";
import { getSchedulerConfig, type SchedulerBindings } from "#config.ts";
import { runCrawlSchedule } from "#crawlScheduler.ts";
import { dispatchWorkflow } from "#workflowDispatcher.ts";

/** The crawl workflow this scheduler drives. The catalog crawl stays on GitHub's own weekly
 * schedule — a missed or late weekly run costs nothing, unlike a missed game-evening crawl. */
const crawlWorkflowValue = "crawl-leagues.yml";

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
      workflow: crawlWorkflowValue,
    });

    // Throw at the transport boundary so Cloudflare records the invocation as failed and it shows
    // up in Workers Logs — the service itself never throws.
    if (!result.ok) {
      throw new Error(result.error.message, { cause: result.error.cause });
    }
  },
};
