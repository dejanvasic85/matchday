// Remove-crawl-target job: transport glue (AGENTS.md) — builds the real DB client and delegates the
// removal to the service, by id or by competition-and-league name.

import { type Logger, type Result, type Source } from "@matchday/domain";
import {
  createDbClient,
  deleteCrawlTargetById,
  deleteCrawlTargetByLeague,
  findCompetitionsBySourceAndName,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  removeCrawlTargetById,
  removeCrawlTargetByLeague,
  type RemoveCrawlTargetOutcome,
} from "#services/crawlTargetService.ts";

export type RemoveCrawlTargetTarget =
  | { kind: "id"; id: string }
  | { kind: "league"; source: Source; competitionName: string; leagueName: string };

export type RunRemoveCrawlTargetJobInput = {
  logger: Logger;
  config: CliConfig;
  target: RemoveCrawlTargetTarget;
};

export async function runRemoveCrawlTargetJob(
  input: RunRemoveCrawlTargetJobInput,
): Promise<Result<RemoveCrawlTargetOutcome>> {
  const { logger, config, target } = input;

  const db = createDbClient(config.DATABASE_URL);
  const deps = {
    findCompetitionsBySourceAndName: (source: Source, name: string) =>
      findCompetitionsBySourceAndName(db, source, name),
    deleteCrawlTargetById: (id: string) => deleteCrawlTargetById(db, id),
    deleteCrawlTargetByLeague: (competitionId: string, leagueName: string) =>
      deleteCrawlTargetByLeague(db, competitionId, leagueName),
  };

  const result =
    target.kind === "id"
      ? await removeCrawlTargetById(deps, target.id)
      : await removeCrawlTargetByLeague(deps, target);

  if (result.ok && result.value.status === "removed") {
    logger.info("crawltarget.removed", "removed crawl target", { id: result.value.id });
  }

  return result;
}
