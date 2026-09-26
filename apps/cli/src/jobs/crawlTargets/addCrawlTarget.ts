// Add-crawl-target job: transport glue (AGENTS.md) — builds the real DB client and delegates the
// resolve-and-write to the service.

import { type Logger, type Result, type Source } from "@matchday/domain";
import {
  createDbClient,
  findCompetitionsBySourceAndName,
  listLeagueNamesByCompetitionId,
  upsertCrawlTarget,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { addCrawlTarget, type AddCrawlTargetOutcome } from "#services/crawlTargetService.ts";

export type RunAddCrawlTargetJobInput = {
  logger: Logger;
  config: CliConfig;
  source: Source;
  competitionName: string;
  leagueName: string;
};

export async function runAddCrawlTargetJob(
  input: RunAddCrawlTargetJobInput,
): Promise<Result<AddCrawlTargetOutcome>> {
  const { logger, config, source, competitionName, leagueName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await addCrawlTarget(
    {
      findCompetitionsBySourceAndName: (fromSource, name) =>
        findCompetitionsBySourceAndName(db, fromSource, name),
      listLeagueNamesByCompetitionId: (competitionId) =>
        listLeagueNamesByCompetitionId(db, competitionId),
      upsertCrawlTarget: (values) => upsertCrawlTarget(db, values),
    },
    { source, competitionName, leagueName },
  );

  if (result.ok && result.value.status === "added") {
    logger.info("crawltarget.added", "added crawl target", {
      id: result.value.id,
      competition: result.value.competitionName,
      league: result.value.leagueName,
    });
  }

  return result;
}
