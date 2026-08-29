// Source-adapter contract: a source owns its session lifecycle plus catalog/deep-crawl/club-enrichment.
// Jobs are source-agnostic dispatchers; a new source is just a new adapter in sourceRegistry.ts.

import type { LeagueId, Logger, Result } from "@matchday/domain";
import type { CliConfig } from "#config.ts";
import type { AssetStorage } from "#storage/assetStorage.ts";
import type { DownloadedImage } from "#storage/clubLogoMirror.ts";
import type { RawStorage } from "#storage/rawStorage.ts";
import type { CrawlSource } from "#crawlers/constants.ts";
// `EntityResolutionDeps` is source-agnostic but still lives under crawlers/dribl/ (too wide a blast radius to move now).
// Relocate when a second importer actually needs it from outside crawlers/dribl/.
import type { EntityResolutionDeps } from "#crawlers/dribl/entityResolutionDeps.ts";

export type CrawlCatalogParams = {
  deps: EntityResolutionDeps;
  logger: Logger;
  seasonYear: string;
  maxLeagues?: number;
  /** Windows the flat (competition, league) queue instead of crawling all of it — the
   * crawl-catalog.yml matrix uses this to split one run into many bounded parallel legs, each
   * sized by a prior `countCatalogLeagues` call. */
  offset?: number;
  limit?: number;
  dryRun: boolean;
};

export type CrawlCatalogSummary = {
  competitions: number;
  leagues: number;
  clubs: number;
  teams: number;
  tableEntries: number;
};

export type CountCatalogLeaguesParams = {
  logger: Logger;
  maxLeagues?: number;
};

export type CountCatalogLeaguesSummary = {
  total: number;
};

export type DeepCrawlParams = {
  deps: EntityResolutionDeps;
  rawStorage: RawStorage;
  logger: Logger;
  leagueId: LeagueId;
  dryRun: boolean;
};

export type DeepCrawlSummary = {
  fixtures: number;
  tableEntries: number;
};

export type CrawlClubEnrichmentParams = {
  deps: EntityResolutionDeps;
  rawStorage: RawStorage;
  assetStorage: AssetStorage;
  downloadImage: (url: string) => Promise<Result<DownloadedImage>>;
  publicAssetsBaseUrl: string;
  logger: Logger;
  dryRun: boolean;
};

export type CrawlClubEnrichmentSummary = {
  listed: number;
  updated: number;
  skipped: number;
};

export type SourceSession = {
  crawlCatalog(params: CrawlCatalogParams): Promise<Result<CrawlCatalogSummary>>;
  /** Cheap listing-only companion to `crawlCatalog` (no table/fixture fetches, no persistence) —
   * sizes the crawl-catalog.yml matrix ahead of the real crawl. */
  countCatalogLeagues(
    params: CountCatalogLeaguesParams,
  ): Promise<Result<CountCatalogLeaguesSummary>>;
  deepCrawlLeague(params: DeepCrawlParams): Promise<Result<DeepCrawlSummary>>;
  crawlClubEnrichment(
    params: CrawlClubEnrichmentParams,
  ): Promise<Result<CrawlClubEnrichmentSummary>>;
  close(): Promise<void>;
};

export type SourceAdapter = {
  source: CrawlSource;
  openSession(config: CliConfig): Promise<Result<SourceSession>>;
};
