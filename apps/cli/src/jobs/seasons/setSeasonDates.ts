// Set-season-dates job: transport glue (AGENTS.md) — builds the real DB client and delegates the
// validate-and-write to the service.

import { type Logger, type Result } from "@matchday/domain";
import { createDbClient, setSeasonDatesByName } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { setSeasonDates, type SeasonDates } from "#services/seasonDateService.ts";

export type RunSetSeasonDatesJobInput = {
  logger: Logger;
  config: CliConfig;
  seasonName: string;
  startsOn: string;
  endsOn: string;
};

/** `null` when no season has that name — the caller reports "no such season" and exits non-zero. */
export async function runSetSeasonDatesJob(
  input: RunSetSeasonDatesJobInput,
): Promise<Result<SeasonDates | null>> {
  const { logger, config, seasonName, startsOn, endsOn } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await setSeasonDates(
    { setSeasonDatesByName: (name, starts, ends) => setSeasonDatesByName(db, name, starts, ends) },
    seasonName,
    startsOn,
    endsOn,
  );

  if (result.ok && result.value !== null) {
    logger.info("season.dates.set", "set season dates", {
      seasonName: result.value.seasonName,
      startsOn: result.value.startsOn,
      endsOn: result.value.endsOn,
    });
  }

  return result;
}
