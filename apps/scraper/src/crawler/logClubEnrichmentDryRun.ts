// Dry-run output for the club-enrichment crawl: logs each crawled club instead of persisting it,
// so `mday club-enrichment --dry-run` shows what a real run would upsert without touching the DB
// or uploading logos to R2.

import type { Logger, MappedClubDetail } from "@matchday/domain";

export function logClubEnrichmentDryRun(logger: Logger, clubs: MappedClubDetail[]): void {
  logger.info("clubenrichment.dryRun", "club enrichment crawl complete (dry run, not persisted)", {
    clubs: clubs.length,
  });

  for (const club of clubs) {
    logger.info("clubenrichment.club", club.name, {
      sourceId: club.sourceId,
      hasGrounds: club.grounds !== null,
      color: club.color,
      store: club.store,
    });
  }
}
