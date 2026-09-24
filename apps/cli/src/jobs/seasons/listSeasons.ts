// List-seasons job: transport glue (AGENTS.md). Prints seasons with their calendar window so an
// operator can see which ones still need dates before a sync relies on them.

import { type Result } from "@matchday/domain";
import { createDbClient, listSeasons, type Page } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listSeasonSummaries, type SeasonSummary } from "#services/seasonService.ts";

export type RunListSeasonsJobInput = {
  config: CliConfig;
};

// No success logging: this job's output *is* what `mday season list` prints, so a log line would
// be noise interleaved with the table on stdout. Failures are logged by the caller.
export async function runListSeasonsJob(
  input: RunListSeasonsJobInput,
): Promise<Result<Page<SeasonSummary>>> {
  const { config } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await listSeasons(db);
  if (!result.ok) {
    return result;
  }
  return listSeasonSummaries(result.value);
}
