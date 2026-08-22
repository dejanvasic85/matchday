// Dry-run output for the catalog crawl: logs each league's table entries instead of persisting,
// so `mday catalog --dry-run` shows what a real run would upsert without touching the DB.

import type { Logger } from "@matchday/domain";
import type { CrawlCatalogLeagueResult } from "#crawlers/dribl/catalogCrawler.ts";

export function logCatalogDryRun(logger: Logger, leagues: CrawlCatalogLeagueResult[]): void {
  logger.info("catalog.dryRun", "catalog crawl complete (dry run, not persisted)", {
    leagues: leagues.length,
  });

  for (const { competitionName, leagueName, tableEntries, fixtureTeams } of leagues) {
    for (const entry of tableEntries) {
      logger.info("catalog.tableEntry", `${entry.position}. ${entry.teamName}`, {
        competitionName,
        leagueName,
        clubName: entry.clubName,
        clubCode: entry.clubCode,
        played: entry.played,
        points: entry.points,
      });
    }

    for (const team of fixtureTeams) {
      logger.info("catalog.fixtureTeam", team.name, {
        competitionName,
        leagueName,
      });
    }
  }
}
