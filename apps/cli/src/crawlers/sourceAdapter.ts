// The source-adapter contract (0012, docs/todo.md Phase 3): a source owns its own session
// lifecycle (Cloudflare clearance for Dribl; whatever a future source needs) plus the three
// crawl concerns ADR 0012 names — catalog, deep-crawl, club-enrichment. Identity mapping isn't a
// fourth method: it's already encapsulated inside each operation via that source's own mappers
// and entity resolvers, exactly as it is today.
//
// Jobs (src/jobs/*.ts) are source-agnostic dispatchers: look up a `SourceAdapter` for a
// `CrawlSource`, open a session, call the matching method, close it. A new source is a new
// adapter registered in sourceRegistry.ts — no job or CLI changes required.

import type { LeagueId, Logger, Result } from "@matchday/domain";
import type { CliConfig } from "../config.ts";
import type { AssetStorage } from "../storage/assetStorage.ts";
import type { DownloadedImage } from "../storage/clubLogoMirror.ts";
import type { RawStorage } from "../storage/rawStorage.ts";
import type { CrawlSource } from "./constants.ts";
// `EntityResolutionDeps` is fully source-agnostic (generic @matchday/db upsert bindings) but still
// lives under crawlers/dribl/ from before this seam existed — same misplacement rawStorage.ts /
// assetStorage.ts / clubLogoMirror.ts had. Not relocated here: it's imported by ~20 dribl-specific
// resolver/persistence files, too wide a blast radius for this slice. Relocate alongside adding
// the Masters adapter, when a second importer actually needs it from outside crawlers/dribl/.
import type { EntityResolutionDeps } from "./dribl/entityResolutionDeps.ts";

export type CrawlCatalogParams = {
  deps: EntityResolutionDeps;
  logger: Logger;
  seasonYear: string;
  maxLeagues?: number;
  dryRun: boolean;
};

export type CrawlCatalogSummary = {
  leagues: number;
  tableEntries: number;
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
