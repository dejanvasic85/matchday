#!/usr/bin/env node
// `mday` — the scraper CLI (0012). Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import { createConsoleLogger, parseId, type LeagueId } from "@matchday/domain";
import { Command, InvalidArgumentError } from "commander";
import { getScraperConfig } from "./config.ts";
import { runCatalogJob } from "./jobs/catalogJob.ts";
import { runDeepCrawlJob } from "./jobs/deepCrawlJob.ts";

const currentYear = new Date().getFullYear().toString();

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

function parseLeagueId(value: string): LeagueId {
  const leagueId = parseId(value, "league");
  if (leagueId === undefined) {
    throw new InvalidArgumentError('must be a "lea_"-prefixed league id');
  }
  return leagueId;
}

export function createCli(): Command {
  const program = new Command();

  program.name("mday").description("matchday scraper CLI").version("0.0.0");

  program
    .command("catalog")
    .description(
      "Crawl all competitions, leagues and teams (with their clubs) for a source + season, " +
        "upserting the catalog used by onboarding dropdowns. Cheap and source-wide; run weekly " +
        "or monthly.",
    )
    .option("--season <year>", "season year to catalog", currentYear)
    .option(
      "--max-leagues <count>",
      "crawl at most this many leagues per competition (default: all)",
      parsePositiveInt,
    )
    .option("--dry-run", "crawl and log the catalog without writing to the database", false)
    .action(async (options: { season: string; maxLeagues?: number; dryRun: boolean }) => {
      const config = getScraperConfig();
      const logger = createConsoleLogger();
      const result = await runCatalogJob({
        logger,
        databaseUrl: config.DATABASE_URL,
        driblSiteUrl: config.DRIBL_SITE_URL,
        tenantHost: new URL(config.DRIBL_SITE_URL).host,
        tenantSlug: config.DRIBL_TENANT_SLUG,
        seasonYear: options.season,
        maxLeagues: options.maxLeagues,
        dryRun: options.dryRun,
      });
      if (!result.ok) {
        logger.error("catalog.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
      }
    });

  program
    .command("deep-crawl")
    .description(
      "Crawl fixtures + table for one league, discovering clubs/teams and persisting via " +
        "entity resolution. Expensive; run at a fixture-derived cadence per 0003.",
    )
    .requiredOption("--league <lea_id>", "the league id to crawl", parseLeagueId)
    .option(
      "--dry-run",
      "crawl and stage to R2, logging a summary, without writing to the database",
      false,
    )
    .action(async (options: { league: LeagueId; dryRun: boolean }) => {
      const config = getScraperConfig();
      const logger = createConsoleLogger();
      const result = await runDeepCrawlJob({
        logger,
        databaseUrl: config.DATABASE_URL,
        driblSiteUrl: config.DRIBL_SITE_URL,
        tenantHost: new URL(config.DRIBL_SITE_URL).host,
        tenantSlug: config.DRIBL_TENANT_SLUG,
        leagueId: options.league,
        dryRun: options.dryRun,
        rawStorageConfig: {
          accountId: config.R2_ACCOUNT_ID,
          accessKeyId: config.R2_ACCESS_KEY_ID,
          secretAccessKey: config.R2_SECRET_ACCESS_KEY,
          bucketName: config.R2_RAW_BUCKET_NAME,
        },
      });
      if (!result.ok) {
        logger.error("deepcrawl.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
      }
    });

  return program;
}

await createCli().parseAsync();
