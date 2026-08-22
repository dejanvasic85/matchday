#!/usr/bin/env node
// `mday` — the crawler CLI (0012). Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import {
  createConsoleLogger,
  parseId,
  type ApiTokenId,
  type LeagueId,
  type SubscriptionId,
} from "@matchday/domain";
import { Command, InvalidArgumentError, Option } from "commander";
import { renderClientTable } from "#clientTable.ts";
import { renderClubLeagueTable } from "#clubLeagueTable.ts";
import { getCliConfig } from "#config.ts";
import { crawlSourceValue, type CrawlSource } from "#crawlers/constants.ts";
import { runCatalogJob } from "#jobs/crawls/catalog.ts";
import { runCountCatalogLeaguesJob } from "#jobs/crawls/countCatalogLeagues.ts";
import { runClubEnrichmentJob } from "#jobs/clubs/enrichClubs.ts";
import { runListClubLeaguesJob } from "#jobs/clubs/listClubLeagues.ts";
import { runClearSubscriptionWebhookJob } from "#jobs/clients/clearSubscriptionWebhook.ts";
import { runCreateApiTokenJob } from "#jobs/clients/createApiToken.ts";
import { runCreateClientJob } from "#jobs/clients/createClient.ts";
import { runCreateSubscriptionJob } from "#jobs/clients/createSubscription.ts";
import { runCreateSubscriptionsForClubJob } from "#jobs/clients/createSubscriptionsForClub.ts";
import { runDeepCrawlJob } from "#jobs/crawls/deepCrawl.ts";
import { runListClientsJob } from "#jobs/clients/listClients.ts";
import { runBackfillLeagueTeamsJob } from "#jobs/maintenance/backfillLeagueTeams.ts";
import { runRemoveSubscriptionJob } from "#jobs/clients/removeSubscription.ts";
import { runRevokeApiTokenJob } from "#jobs/clients/revokeApiToken.ts";
import { runSetSubscriptionWebhookJob } from "#jobs/clients/setSubscriptionWebhook.ts";
import { runSubscribedLeaguesJob } from "#jobs/crawls/subscribedLeagues.ts";

const currentYear = new Date().getFullYear().toString();
const crawlSources = Object.values(crawlSourceValue);

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidArgumentError("must be a non-negative integer");
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

function parseSubscriptionId(value: string): SubscriptionId {
  const id = parseId(value, "subscription");
  if (id === undefined) {
    throw new InvalidArgumentError('must be a "sub_"-prefixed subscription id');
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
        "or monthly. --offset/--limit crawl a window of the flat league queue instead of all of " +
        "it (the crawl-catalog.yml matrix's per-leg scope); --count skips crawling and just " +
        "prints how many leagues are queued, to size that matrix.",
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
    .option(
      "--offset <count>",
      "skip this many leagues at the front of the queue (default: 0)",
      parseNonNegativeInt,
    )
    .option(
      "--limit <count>",
      "crawl at most this many leagues from the queue, starting at --offset (default: all)",
      parsePositiveInt,
    )
    .option(
      "--count",
      "print how many leagues are queued instead of crawling (for sizing the crawl-catalog.yml matrix)",
      false,
    )
    .option("--dry-run", "crawl and log the catalog without writing to the database", false)
    .action(
      async (options: {
        source: CrawlSource;
        season: string;
        maxLeagues?: number;
        offset?: number;
        limit?: number;
        count: boolean;
        dryRun: boolean;
      }) => {
        const config = getCliConfig();
        const logger = createConsoleLogger();

        if (options.count) {
          const result = await runCountCatalogLeaguesJob({
            logger,
            config,
            source: options.source,
            maxLeagues: options.maxLeagues,
          });
          if (!result.ok) {
            logger.error("catalog.count.failed", result.error.message, {
              cause: result.error.cause,
            });
            process.exitCode = 1;
            return;
          }
          process.stdout.write(`${JSON.stringify({ total: result.value })}\n`);
          return;
        }

        const result = await runCatalogJob({
          logger,
          config,
          source: options.source,
          seasonYear: options.season,
          maxLeagues: options.maxLeagues,
          offset: options.offset,
          limit: options.limit,
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

  const club = program
    .command("club")
    .description("Look up clubs and the leagues their teams play in (#85).");

  club
    .command("leagues")
    .description(
      "List the distinct leagues a club's teams play in, resolved via league_team (#144) — a " +
        "league is only discoverable here once the catalog crawl has run for it at least once " +
        "(fine for onboarding a club into an existing dataset, circular for a brand-new league). " +
        "A name matching more than one club fails listing every candidate rather than guessing.",
    )
    .argument("<name>", "a club name, or a fragment of one")
    .option("--json", "print the result as JSON instead of a table", false)
    .action(async (name: string, options: { json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListClubLeaguesJob({ config, clubName: name });
      if (!result.ok) {
        logger.error("club.leaguesfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderClubLeagueTable(result.value);
      process.stdout.write(`${output}\n`);
    });

  const client = program
    .command("client")
    .description(
      "Manage API consumers (0012/0013): the clients themselves, their league subscriptions " +
        "(which drive the deep crawl's scope), their bearer tokens, and each subscription's " +
        "optional post-crawl webhook (#105).",
    );

  client
    .command("list")
    .description(
      "List every client with its active token count and league subscriptions. Use it to find " +
        "the sub_ id that remove-subscription takes.",
    )
    .option("--json", "print the roster as JSON instead of a table", false)
    .action(async (options: { json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListClientsJob({ config });
      if (!result.ok) {
        logger.error("client.listfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderClientTable(result.value);
      process.stdout.write(`${output}\n`);
    });

  client
    .command("add")
    .description(
      "Create a client by name, printing its cli_ id. Idempotent — re-adding an existing name " +
        "returns that client rather than failing.",
    )
    .argument("<name>", "the client name")
    .action(async (name: string) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCreateClientJob({ logger, config, name });
      if (!result.ok) {
        logger.error("client.addfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${result.value}\n`);
    });

  client
    .command("create-token")
    .description(
      "Issue a new bearer API token for an existing client (0013). Prints the token id and the " +
        "plaintext token — the token is shown once here and never recoverable again, only " +
        "rotatable.",
    )
    .argument("<name>", "the client name")
    .action(async (name: string) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCreateApiTokenJob({ logger, config, clientName: name });
      if (!result.ok) {
        logger.error("apitoken.failed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Token id: ${result.value.id}\n`);
      process.stdout.write(`Token: ${result.value.token}\n`);
      process.stdout.write("Store this token now — it will not be shown again.\n");
    });

  client
    .command("revoke-token")
    .description("Revoke a bearer API token (0013) so it can no longer authenticate requests.")
    .argument("<tok_id>", "the api token id to revoke", parseApiTokenId)
    .action(async (id: ApiTokenId) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runRevokeApiTokenJob({ logger, config, id });
      if (!result.ok) {
        logger.error("apitoken.revokefailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Revoked token: ${id}\n`);
    });

  client
    .command("add-subscription")
    .description(
      "Subscribe an existing client to a league (0012), or to every league a club's teams play " +
        "in (#85) — exactly one of --league/--club. --club resolves via league_team (#144), only " +
        "discoverable once the catalog crawl has run for a league at least once; run `club " +
        "leagues <name>` or pass --dry-run first to preview before writing N subscription rows " +
        "off a single fuzzy name match.",
    )
    .requiredOption("--client <name>", "the client name")
    .addOption(
      new Option("--league <lea_id>", "subscribe to a single league by id")
        .argParser(parseLeagueId)
        .conflicts("club"),
    )
    .addOption(
      new Option(
        "--club <name>",
        "subscribe to every league this club's teams play in (a name fragment is enough, as " +
          "long as it's unambiguous)",
      ).conflicts("league"),
    )
    .option(
      "--dry-run",
      "with --club, resolve and print the club + leagues without subscribing to anything",
      false,
    )
    .action(
      async (options: { client: string; league?: LeagueId; club?: string; dryRun: boolean }) => {
        const logger = createConsoleLogger();

        if (options.league === undefined && options.club === undefined) {
          logger.error("subscription.failed", "one of --league or --club is required");
          process.exitCode = 1;
          return;
        }

        if (options.dryRun && options.league !== undefined) {
          logger.error("subscription.failed", "--dry-run only applies to --club, not --league");
          process.exitCode = 1;
          return;
        }

        const config = getCliConfig();

        if (options.league !== undefined) {
          const result = await runCreateSubscriptionJob({
            logger,
            config,
            clientName: options.client,
            leagueId: options.league,
          });
          if (!result.ok) {
            logger.error("subscription.failed", result.error.message, {
              cause: result.error.cause,
            });
            process.exitCode = 1;
            return;
          }
          process.stdout.write(`${result.value}\n`);
          return;
        }

        const clubName = options.club;
        if (clubName === undefined) {
          // Unreachable: the check above ruled out both undefined, Option.conflicts rules out
          // both set. Kept so `clubName` narrows to `string` without a cast.
          logger.error("subscription.failed", "one of --league or --club is required");
          process.exitCode = 1;
          return;
        }

        const result = await runCreateSubscriptionsForClubJob({
          logger,
          config,
          clientName: options.client,
          clubName,
          dryRun: options.dryRun,
        });
        if (!result.ok) {
          logger.error("subscription.clubfailed", result.error.message, {
            cause: result.error.cause,
          });
          process.exitCode = 1;
          return;
        }

        const { club: matchedClub, leagues, subscriptionIds } = result.value;
        process.stdout.write(`Club: ${matchedClub.name} (${matchedClub.id})\n`);
        if (options.dryRun) {
          process.stdout.write(
            `Dry run — would subscribe "${options.client}" to ${leagues.length} league(s):\n`,
          );
          for (const league of leagues) {
            process.stdout.write(`  ${league.id}  ${league.name}\n`);
          }
          return;
        }
        process.stdout.write(
          `Subscribed "${options.client}" to ${subscriptionIds.length} league(s):\n`,
        );
        for (const id of subscriptionIds) {
          process.stdout.write(`${id}\n`);
        }
      },
    );

  client
    .command("remove-subscription")
    .description(
      "Unsubscribe a client from a league by subscription id (find it via `client list`). The " +
        "league leaves the deep crawl's scope once no client subscribes to it.",
    )
    .argument("<sub_id>", "the subscription id to remove", parseSubscriptionId)
    .action(async (id: SubscriptionId) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runRemoveSubscriptionJob({ logger, config, id });
      if (!result.ok) {
        logger.error("subscription.removefailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Removed subscription: ${id}\n`);
    });

  client
    .command("set-webhook")
    .description(
      "Configure (or rotate) a subscription's webhook (#105): after each deep crawl of its " +
        "league, matchday POSTs { leagueId, hasChanges, crawledAt } to this URL, signed with a " +
        "freshly minted secret (X-Matchday-Signature: sha256=<hex>). The secret is shown once " +
        "here and never recoverable again — re-running this rotates it.",
    )
    .argument("<sub_id>", "the subscription id to configure", parseSubscriptionId)
    .requiredOption("--url <url>", "the http(s) endpoint to POST deliveries to")
    .action(async (id: SubscriptionId, options: { url: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runSetSubscriptionWebhookJob({
        logger,
        config,
        id,
        webhookUrl: options.url,
      });
      if (!result.ok) {
        logger.error("subscription.webhookfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Webhook URL: ${result.value.webhookUrl}\n`);
      process.stdout.write(`Webhook secret: ${result.value.webhookSecret}\n`);
      process.stdout.write("Store this secret now — it will not be shown again.\n");
    });

  client
    .command("clear-webhook")
    .description("Remove a subscription's webhook (#105) so no further deliveries are sent for it.")
    .argument("<sub_id>", "the subscription id to clear", parseSubscriptionId)
    .action(async (id: SubscriptionId) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runClearSubscriptionWebhookJob({ logger, config, id });
      if (!result.ok) {
        logger.error("subscription.webhookclearfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Cleared webhook for subscription: ${id}\n`);
    });

  const leagueTeam = program
    .command("league-team")
    .description("Maintenance for the league_team membership table (#141).");

  leagueTeam
    .command("backfill")
    .description(
      "One-off: upsert a league_team row for every (league, team) pair already in table_entry " +
        "(#143), for leagues crawled before the catalog crawl started writing league_team " +
        "directly. Idempotent — safe to re-run. Table-less leagues (MiniRoos etc.) aren't covered " +
        "here; they need a fresh `catalog` crawl instead, since table_entry has nothing to derive " +
        "their membership from. --dry-run prints the pair count without writing.",
    )
    .option("--dry-run", "count the pairs that would be backfilled without writing", false)
    .action(async (options: { dryRun: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runBackfillLeagueTeamsJob({
        logger,
        config,
        dryRun: options.dryRun,
      });
      if (!result.ok) {
        logger.error("leagueteam.backfillfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      if (options.dryRun) {
        process.stdout.write(`Dry run — would backfill ${result.value.pairs} pair(s).\n`);
        return;
      }
      process.stdout.write(
        `Backfilled ${result.value.upserted} of ${result.value.pairs} pair(s).\n`,
      );
    });

  return program;
}

await createCli().parseAsync();
