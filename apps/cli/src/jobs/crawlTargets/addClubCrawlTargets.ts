// Add-club-crawl-targets job: transport glue (AGENTS.md) — resolves the season, builds the real DB
// client, and delegates the club-to-targets write to the service.

import { type Logger, type Result, type Source } from "@matchday/domain";
import {
  createDbClient,
  findClubsByName,
  findLatestSeason,
  findSeasonByName,
  listCrawlTargets,
  listLeaguesByClubId,
  upsertCrawlTarget,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  addClubCrawlTargets,
  type AddClubCrawlTargetsOutcome,
} from "#services/crawlTargetService.ts";
import { resolveSeason } from "#services/seasonResolver.ts";

export type RunAddClubCrawlTargetsJobInput = {
  logger: Logger;
  config: CliConfig;
  source: Source;
  clubName: string;
  seasonName: string;
  dryRun: boolean;
};

export async function runAddClubCrawlTargetsJob(
  input: RunAddClubCrawlTargetsJobInput,
): Promise<Result<AddClubCrawlTargetsOutcome>> {
  const { logger, config, source, clubName, seasonName, dryRun } = input;

  const db = createDbClient(config.DATABASE_URL);

  const season = await resolveSeason(
    {
      findLatestSeason: (seasonSource) => findLatestSeason(db, seasonSource),
      findSeasonByName: (seasonSource, name) => findSeasonByName(db, seasonSource, name),
    },
    source,
    seasonName,
  );
  if (!season.ok) {
    return season;
  }

  const result = await addClubCrawlTargets(
    {
      findClubsByName: (name) => findClubsByName(db, name),
      listLeaguesByClubId: (clubId, seasonId) => listLeaguesByClubId(db, clubId, seasonId),
      listCrawlTargets: () => listCrawlTargets(db),
      upsertCrawlTarget: (values) => upsertCrawlTarget(db, values),
    },
    { clubName, seasonId: season.value.id, dryRun },
  );

  if (result.ok) {
    logger.info("crawltarget.clubadded", "added a club's leagues to the crawl scope", {
      club: result.value.club.name,
      added: result.value.added.length,
      alreadyTargeted: result.value.alreadyTargeted.length,
      dryRun: result.value.dryRun,
    });
  }

  return result;
}
