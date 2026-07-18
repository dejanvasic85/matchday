#!/usr/bin/env node
// `mday` — the scraper CLI (0012). Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import { createConsoleLogger } from "@matchday/domain";
import { Command, InvalidArgumentError } from "commander";
import { getScraperConfig } from "./config.ts";
import { runCatalogJob } from "./jobs/catalogJob.ts";

const currentYear = new Date().getFullYear().toString();

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
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
    .action(async (options: { season: string; maxLeagues?: number }) => {
      const config = getScraperConfig();
      const logger = createConsoleLogger();
      const result = await runCatalogJob({
        logger,
        driblSiteUrl: config.DRIBL_SITE_URL,
        tenantHost: new URL(config.DRIBL_SITE_URL).host,
        tenantSlug: config.DRIBL_TENANT_SLUG,
        seasonYear: options.season,
        maxLeagues: options.maxLeagues,
      });
      if (!result.ok) {
        logger.error("catalog.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
      }
    });

  return program;
}

await createCli().parseAsync();
