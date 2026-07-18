// Catalog crawl (0012): cheap, source-wide enumeration of competitions, leagues, teams and their
// clubs for a season, upserted as first-class rows with `external_ref`. Populates the onboarding
// dropdowns; runs on a schedule regardless of subscriptions. Crawl logic lands in a later slice —
// this is the service entry point the CLI (transport) calls into.

import type { Logger } from "@matchday/domain";

export type RunCatalogJobInput = {
  logger: Logger;
  tenantSlug: string;
  seasonYear: string;
};

export function runCatalogJob(input: RunCatalogJobInput): void {
  const { logger, tenantSlug, seasonYear } = input;
  logger.info("catalog.start", "catalog crawl not yet implemented", { tenantSlug, seasonYear });
}
