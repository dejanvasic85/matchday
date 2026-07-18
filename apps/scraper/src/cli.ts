#!/usr/bin/env node
// `mday` — the scraper CLI (0012). Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import { createConsoleLogger } from "@matchday/domain";
import { Command } from "commander";
import { getScraperConfig } from "./config.ts";
import { runCatalogJob } from "./jobs/catalogJob.ts";

const currentYear = new Date().getFullYear().toString();

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
    .action((options: { season: string }) => {
      const config = getScraperConfig();
      const logger = createConsoleLogger();
      runCatalogJob({
        logger,
        tenantSlug: config.DRIBL_TENANT_SLUG,
        seasonYear: options.season,
      });
    });

  return program;
}

createCli().parse();
