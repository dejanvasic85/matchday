// List-seasons job: transport glue (AGENTS.md). Prints seasons with their calendar window so an
// operator can see which ones still need dates before a sync relies on them.

import { ok, type Result } from "@matchday/domain";
import { createDbClient, listSeasons, type Db } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { toSeasonSummary, type SeasonSummary } from "#services/seasonService.ts";

export type RunListSeasonsJobInput = {
  config: CliConfig;
};

/** Every season, paging until the cursor runs out. There are only a handful, but a default-paged
 * first page would silently truncate the list. */
async function listAllSeasons(db: Db): Promise<Result<SeasonSummary[]>> {
  const all: SeasonSummary[] = [];
  let cursor: string | undefined;

  for (;;) {
    const result = await listSeasons(db, { cursor });
    if (!result.ok) {
      return result;
    }
    all.push(...result.value.rows.map(toSeasonSummary));
    const next = result.value.nextCursor;
    if (next === null) {
      return ok(all);
    }
    cursor = next;
  }
}

// No success logging: this job's output *is* what `mday season list` prints, so a log line would
// be noise interleaved with the table on stdout. Failures are logged by the caller.
export async function runListSeasonsJob(
  input: RunListSeasonsJobInput,
): Promise<Result<SeasonSummary[]>> {
  const { config } = input;

  const db = createDbClient(config.DATABASE_URL);
  return listAllSeasons(db);
}
