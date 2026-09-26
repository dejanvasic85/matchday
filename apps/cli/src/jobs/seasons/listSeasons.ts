// List-seasons job: transport glue (AGENTS.md). Prints each competition's season window, so an
// operator can see which windows still need dates before a sync relies on them.

import { ok, type Result, type Source } from "@matchday/domain";
import { createDbClient, listSeasonWindows } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { toSeasonWindowSummary, type SeasonWindowSummary } from "#services/seasonService.ts";

export type RunListSeasonsJobInput = {
  config: CliConfig;
  /** Restrict to one source's windows. Omitted lists every source's. */
  source?: Source;
};

// No success logging: this job's output *is* what `mday season list` prints, so a log line would
// be noise interleaved with the table on stdout. Failures are logged by the caller.
export async function runListSeasonsJob(
  input: RunListSeasonsJobInput,
): Promise<Result<SeasonWindowSummary[]>> {
  const { config, source } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await listSeasonWindows(db, source === undefined ? {} : { source });
  if (!result.ok) {
    return result;
  }
  return ok(result.value.map(toSeasonWindowSummary));
}
