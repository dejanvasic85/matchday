// Backfill league_team job: one-off admin op that populates league_team
// from existing table_entry rows. Table-less leagues (MiniRoos etc.) need a fresh crawl instead.

import { type Logger, type Result } from "@matchday/domain";
import { createDbClient, listTableEntryTeamPairs, upsertLeagueTeam } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  backfillLeagueTeams,
  type LeagueTeamBackfillResult,
} from "#services/leagueTeamBackfillService.ts";

export type RunBackfillLeagueTeamsJobInput = {
  logger: Logger;
  config: CliConfig;
  dryRun: boolean;
};

export async function runBackfillLeagueTeamsJob(
  input: RunBackfillLeagueTeamsJobInput,
): Promise<Result<LeagueTeamBackfillResult>> {
  const { logger, config, dryRun } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await backfillLeagueTeams(
    {
      listTableEntryTeamPairs: () => listTableEntryTeamPairs(db),
      upsertLeagueTeam: (values) => upsertLeagueTeam(db, values),
    },
    dryRun,
  );

  if (result.ok) {
    logger.info("leagueteam.backfill", "backfilled league_team from table_entry", {
      pairs: result.value.pairs,
      upserted: result.value.upserted,
      dryRun,
    });
  }

  return result;
}
