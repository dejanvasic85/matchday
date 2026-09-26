// Set-season-dates job: transport glue (AGENTS.md) — builds the real DB client and delegates the
// validate-and-write to the service.

import { type Logger, type Result, type Source } from "@matchday/domain";
import {
  createDbClient,
  findCompetitionsByName,
  findSeasonByName,
  setCompetitionSeasonDates,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { setSeasonDates, type SeasonDatesWrite } from "#services/seasonDateService.ts";

export type RunSetSeasonDatesJobInput = {
  logger: Logger;
  config: CliConfig;
  source: Source;
  seasonName: string;
  competitionName: string;
  startsOn: string;
  endsOn: string;
};

export async function runSetSeasonDatesJob(
  input: RunSetSeasonDatesJobInput,
): Promise<Result<SeasonDatesWrite>> {
  const { logger, config, source, seasonName, competitionName, startsOn, endsOn } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await setSeasonDates(
    {
      findSeasonByName: (seasonSource, name) => findSeasonByName(db, seasonSource, name),
      findCompetitionsByName: (name) => findCompetitionsByName(db, name),
      setCompetitionSeasonDates: (values) => setCompetitionSeasonDates(db, values),
    },
    { source, seasonName, competitionName, startsOn, endsOn },
  );

  if (result.ok && result.value.status === "written") {
    logger.info("season.dates.set", "set competition season dates", {
      source: result.value.source,
      seasonName: result.value.seasonName,
      competitionName: result.value.competitionName,
      startsOn: result.value.startsOn,
      endsOn: result.value.endsOn,
    });
  }

  return result;
}
