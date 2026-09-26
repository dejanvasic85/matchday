// List-crawl-targets job: transport glue (AGENTS.md). Returns the flat summaries the command
// prints; no success logging, so stdout stays the payload alone.

import type { Result } from "@matchday/domain";
import { createDbClient, listCrawlTargets } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listCrawlTargetsSummary, type CrawlTargetSummary } from "#services/crawlTargetService.ts";

export type RunListCrawlTargetsJobInput = {
  config: CliConfig;
};

export async function runListCrawlTargetsJob(
  input: RunListCrawlTargetsJobInput,
): Promise<Result<CrawlTargetSummary[]>> {
  const db = createDbClient(input.config.DATABASE_URL);
  return listCrawlTargetsSummary({ listCrawlTargets: () => listCrawlTargets(db) });
}
