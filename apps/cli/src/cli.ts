#!/usr/bin/env node
// `mday` — the crawler CLI (0012). Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import { createConsoleLogger, parseId, type ApiTokenId, type LeagueId } from "@matchday/domain";
import { Command, InvalidArgumentError } from "commander";
import { getCliConfig } from "./config.ts";
import { crawlSourceValue, type CrawlSource } from "./crawlers/constants.ts";
import { runCatalogJob } from "./jobs/catalogJob.ts";
import { runClubEnrichmentJob } from "./jobs/clubEnrichmentJob.ts";
import { runCreateApiTokenJob } from "./jobs/createApiTokenJob.ts";
import { runCreateSubscriptionJob } from "./jobs/createSubscriptionJob.ts";
import { runDeepCrawlJob } from "./jobs/deepCrawlJob.ts";
import { runRevokeApiTokenJob } from "./jobs/revokeApiTokenJob.ts";
import { runSubscribedLeaguesJob } from "./jobs/subscribedLeaguesJob.ts";

const currentYear = new Date().getFullYear().toString();
const crawlSources = Object.values(crawlSourceValue);

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

function parseApiTokenId(value: string): ApiTokenId {
  const id = parseId(value, "apiToken");
  if (id === undefined) {
    throw new InvalidArgumentError('must be a "tok_"-prefixed api token id');
  }
  return id;
}

function parseCrawlSource(value: string): CrawlSource {
  const source = crawlSources.find((candidate) => candidate === value);
  if (source === undefined) {
    throw new InvalidArgumentError(`must be one of: ${crawlSources.join(", ")}`);
  }
  return source;
}

export function createCli(): Command {
  const program = new Command();

  program.name("mday").description("matchday crawler CLI").version("0.0.0");

  program
    .command("catalog")
    .description(
      "Crawl all competitions, leagues and teams (with their clubs) for a source + season, " +
        "upserting the catalog used by onboarding dropdowns. Cheap and source-wide; run weekly " +
        "or monthly.",
    )
    .option(
      "--source <name>",
      `source to crawl (${crawlSources.join(", ")})`,
      parseCrawlSource,
      crawlSourceValue.dribl,
    )
    .option("--season <year>", "season year to catalog", currentYear)
    .option(
      "--max-leagues <count>",
      "crawl at most this many leagues per competition (default: all)",
      parsePositiveInt,
    )
    .option("--dry-run", "crawl and log the catalog without writing to the database", false)
    .action(
      async (options: {
        source: CrawlSource;
        season: string;
        maxLeagues?: number;
        dryRun: boolean;
      }) => {
        const config = getCliConfig();
        const logger = createConsoleLogger();
        const result = await runCatalogJob({
          logger,
          config,
          source: options.source,
          seasonYear: options.season,
          maxLeagues: options.maxLeagues,
          dryRun: options.dryRun,
        });
        if (!result.ok) {
          logger.error("catalog.failed", result.error.message, { cause: result.error.cause });
          process.exitCode = 1;
        }
      },
    );

  program
    .command("subscribed-leagues")
    .description(
      "List the distinct set of league ids with >=1 subscription, as JSON — the scope the " +
        "deep-crawl GitHub Actions matrix crawls each run (0012).",
    )
    .action(async () => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runSubscribedLeaguesJob({ logger, config });
      if (!result.ok) {
        logger.error("subscribedleagues.failed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
      }
    });

  program
    .command("deep-crawl")
    .description(
      "Crawl fixtures + table for one league, discovering clubs/teams and persisting via " +
        "entity resolution. Expensive; run at a fixture-derived cadence per 0003.",
    )
    .option(
      "--source <name>",
      `source to crawl (${crawlSources.join(", ")})`,
      parseCrawlSource,
      crawlSourceValue.dribl,
    )
    .requiredOption("--league <lea_id>", "the league id to crawl", parseLeagueId)
    .option(
      "--dry-run",
      "crawl and stage to R2, logging a summary, without writing to the database",
      false,
    )
    .action(async (options: { source: CrawlSource; league: LeagueId; dryRun: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runDeepCrawlJob({
        logger,
        config,
        source: options.source,
        leagueId: options.league,
        dryRun: options.dryRun,
      });
      if (!result.ok) {
        logger.error("deepcrawl.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
      }
    });

  program
    .command("club-enrichment")
    .description(
      "Fetch rich club detail (grounds/colours/store) from clubs/{id} and mirror logos to R2 " +
        "for every club the catalog/deep crawl has already discovered. Attaches only, never " +
        "creates; source-wide, not season/league-scoped. Run weekly, right after the catalog " +
        "crawl (it depends on the catalog's clubs).",
    )
    .option(
      "--source <name>",
      `source to crawl (${crawlSources.join(", ")})`,
      parseCrawlSource,
      crawlSourceValue.dribl,
    )
    .option(
      "--dry-run",
      "crawl and stage to R2, logging a summary, without writing to the database or uploading logos",
      false,
    )
    .action(async (options: { source: CrawlSource; dryRun: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runClubEnrichmentJob({
        logger,
        config,
        source: options.source,
        dryRun: options.dryRun,
      });
      if (!result.ok) {
        logger.error("clubenrichment.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
      }
    });

  program
    .command("subscription-create")
    .description(
      "Subscribe a client to a league (0012): links a client name to our internal league id, " +
        "driving the deep crawl's scope. Prints the created subscription id.",
    )
    .requiredOption("--client <name>", "the client name")
    .requiredOption("--league <lea_id>", "the league id to subscribe to", parseLeagueId)
    .action(async (options: { client: string; league: LeagueId }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCreateSubscriptionJob({
        logger,
        config,
        clientName: options.client,
        leagueId: options.league,
      });
      if (!result.ok) {
        logger.error("subscription.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${result.value}\n`);
    });

  program
    .command("api-token-create")
    .description(
      "Issue a new bearer API token for a client (0013). Prints the token id and the plaintext " +
        "token — the token is shown once here and never recoverable again, only rotatable.",
    )
    .requiredOption("--client <name>", "the client name")
    .action(async (options: { client: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCreateApiTokenJob({ logger, config, clientName: options.client });
      if (!result.ok) {
        logger.error("apitoken.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Token id: ${result.value.id}\n`);
      process.stdout.write(`Token: ${result.value.token}\n`);
      process.stdout.write("Store this token now — it will not be shown again.\n");
    });

  program
    .command("api-token-revoke")
    .description("Revoke a bearer API token (0013) so it can no longer authenticate requests.")
    .requiredOption("--id <tok_id>", "the api token id to revoke", parseApiTokenId)
    .action(async (options: { id: ApiTokenId }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runRevokeApiTokenJob({ logger, config, id: options.id });
      if (!result.ok) {
        logger.error("apitoken.revokefailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Revoked token: ${options.id}\n`);
    });

  return program;
}

await createCli().parseAsync();
