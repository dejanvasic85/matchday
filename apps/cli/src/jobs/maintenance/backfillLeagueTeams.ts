// Backfill league_team job (#143): transport glue (AGENTS.md) — builds the real DB client and
// delegates to the service. One-off admin operation: run once after #142 ships to populate
// league_team for every league that already has a table_entry (leagues discovered from a table);
// table-less leagues (MiniRoos etc.) need a fresh catalog crawl instead, since there's nothing to
// derive their membership from in the existing data.

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
