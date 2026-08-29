#!/usr/bin/env node
// `mday` — the crawler CLI. Thin commander wiring: each command constructs real
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
import { renderSubscriptionTable, renderSyncPlan } from "#subscriptionTable.ts";
import { renderClubLeagueTable } from "#clubLeagueTable.ts";
import { getCliConfig } from "#config.ts";
import { crawlSourceValue, type CrawlSource } from "#crawlers/constants.ts";
import { runCatalogJob } from "#jobs/crawls/catalog.ts";
import { runCountCatalogLeaguesJob } from "#jobs/crawls/countCatalogLeagues.ts";
import { runClubEnrichmentJob } from "#jobs/clubs/enrichClubs.ts";
import { runListClubLeaguesJob } from "#jobs/clubs/listClubLeagues.ts";
import { runCreateApiTokenJob } from "#jobs/clients/createApiToken.ts";
import { runCreateClientJob } from "#jobs/clients/createClient.ts";
import { runCreateSubscriptionJob } from "#jobs/clients/createSubscription.ts";
import { runCreateSubscriptionsForClubJob } from "#jobs/clients/createSubscriptionsForClub.ts";
import {
  runClearClientClubWebhookJob,
  runSetClientClubWebhookJob,
} from "#jobs/clients/clientClubWebhook.ts";
import { runFollowClubJob, runUnfollowClubJob } from "#jobs/clients/followClub.ts";
import { runListSubscriptionsJob } from "#jobs/clients/listSubscriptions.ts";
import { runSyncSubscriptionsJob } from "#jobs/clients/syncSubscriptions.ts";
import { runCrawlLeaguesJob } from "#jobs/crawls/crawlLeagues.ts";
import { runListClientsJob } from "#jobs/clients/listClients.ts";
import { runBackfillLeagueTeamsJob } from "#jobs/maintenance/backfillLeagueTeams.ts";
import { runRemoveSubscriptionJob } from "#jobs/clients/removeSubscription.ts";
import { runRevokeApiTokenJob } from "#jobs/clients/revokeApiToken.ts";
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
        "crawl-leagues GitHub Actions matrix crawls each run.",
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
    .command("crawl-leagues")
    .description(
      "Crawl fixtures + table for one subscribed league, discovering clubs/teams and persisting " +
        "via entity resolution. Expensive; run at a cadence derived from fixture dates.",
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
      const result = await runCrawlLeaguesJob({
        logger,
        config,
        source: options.source,
        leagueId: options.league,
        dryRun: options.dryRun,
      });
      if (!result.ok) {
        logger.error("crawlleagues.failed", result.error.message, { cause: result.error.cause });
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
    .description("Look up clubs and the leagues their teams play in.");

  club
    .command("leagues")
    .description(
      "List the distinct leagues a club's teams play in, resolved via league_team — a " +
        "league is only discoverable here once the catalog crawl has run for it at least once " +
        "(fine for onboarding a club into an existing dataset, circular for a brand-new league). " +
        "A name matching more than one club fails listing every candidate rather than guessing.",
    )
    .argument("<name>", "a club name, or a fragment of one")
    .option("--season <year>", "only show leagues in this season (default: all seasons)")
    .option("--json", "print the result as JSON instead of a table", false)
    .action(async (name: string, options: { season?: string; json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListClubLeaguesJob({
        config,
        clubName: name,
        seasonName: options.season,
      });
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
      "Manage API consumers: the clients themselves, the clubs they follow, the league " +
        "subscriptions derived from those clubs (which drive the crawl's scope), their bearer " +
        "tokens, and each followed club's optional post-crawl webhook.",
    );

  client
    .command("list")
    .description(
      "List every client with its active token count, followed clubs (and whether each has a " +
        "webhook), and a per-season subscription count. Run `client list-subscriptions` for the " +
        "individual rows and their sub_ ids.",
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
      "Issue a new bearer API token for an existing client. Prints the token id and the " +
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
    .description("Revoke a bearer API token so it can no longer authenticate requests.")
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
    .command("follow-club")
    .description(
      "Record that a client follows a club. This is the provenance `sync-subscriptions` " +
        "re-derives from at a season rollover, and it owns the webhook — so both survive the " +
        "season the subscriptions were created in. Writes no subscriptions itself: run " +
        "`client sync-subscriptions` to see the diff and apply it.",
    )
    .requiredOption("--client <name>", "the client name")
    .requiredOption("--club <name>", "the club name, or an unambiguous fragment of one")
    .action(async (options: { client: string; club: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runFollowClubJob({
        logger,
        config,
        clientName: options.client,
        clubName: options.club,
      });
      if (!result.ok) {
        logger.error("clientclub.followfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(
        `"${options.client}" now follows ${result.value.club.name} (${result.value.club.id})\n`,
      );
      process.stdout.write("Run `mday client sync-subscriptions` to subscribe to its leagues.\n");
    });

  client
    .command("unfollow-club")
    .description(
      "Stop a client following a club. Existing subscriptions stay active until the next " +
        "`sync-subscriptions` prunes them, so this never silently drops a league mid-season.",
    )
    .requiredOption("--client <name>", "the client name")
    .requiredOption("--club <name>", "the club name, or an unambiguous fragment of one")
    .action(async (options: { client: string; club: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runUnfollowClubJob({
        logger,
        config,
        clientName: options.client,
        clubName: options.club,
      });
      if (!result.ok) {
        logger.error("clientclub.unfollowfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(
        `"${options.client}" no longer follows ${result.value.club.name} (${result.value.club.id})\n`,
      );
    });

  client
    .command("sync-subscriptions")
    .description(
      "Reconcile a client's subscriptions against the clubs it follows, for one season. Adds " +
        "every league a followed club plays in this season that isn't subscribed yet, and " +
        "removes subscriptions belonging to *older* seasons — so a season rollover is this one " +
        "command. Prints the diff and writes nothing unless --apply is passed. Requires the " +
        "catalog crawl to have run for the target season first.",
    )
    .requiredOption("--client <name>", "the client name")
    .option("--season <year>", "season to sync to (default: the latest season we hold)")
    .option("--apply", "write the diff instead of only printing it", false)
    .option("--json", "print the plan as JSON instead of a table", false)
    .action(async (options: { client: string; season?: string; apply: boolean; json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runSyncSubscriptionsJob({
        logger,
        config,
        clientName: options.client,
        seasonName: options.season,
        apply: options.apply,
      });
      if (!result.ok) {
        logger.error("subscription.syncfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderSyncPlan(result.value);
      process.stdout.write(`${output}\n`);
    });

  client
    .command("list-subscriptions")
    .description(
      "List one client's active subscriptions with the season each league belongs to, so " +
        "subscriptions left behind by a finished season are obvious. Filtered server-side; " +
        "--json prints the rows alone for piping into jq.",
    )
    .requiredOption("--client <name>", "the client name")
    .option("--season <year>", "only show subscriptions in this season (default: all seasons)")
    .option("--json", "print the rows as JSON instead of a table", false)
    .action(async (options: { client: string; season?: string; json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListSubscriptionsJob({
        config,
        clientName: options.client,
        seasonName: options.season,
      });
      if (!result.ok) {
        logger.error("subscription.listfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderSubscriptionTable(result.value);
      process.stdout.write(`${output}\n`);
    });

  client
    .command("add-subscription")
    .description(
      "Subscribe an existing client to a league, or to every league a club's teams play in " +
        "this season — exactly one of --league/--club. --club also records the follow, so a " +
        "later `sync-subscriptions` can re-derive the same set for a new season. --club resolves " +
        "via league_team, only discoverable once the catalog crawl has run for a league at least " +
        "once; run `club leagues <name>` or pass --dry-run first to preview before writing N " +
        "subscription rows off a single fuzzy name match.",
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
      "--season <year>",
      "with --club, the season to subscribe for (default: the latest season we hold)",
    )
    .option(
      "--dry-run",
      "with --club, resolve and print the club + leagues without subscribing to anything",
      false,
    )
    .action(
      async (options: {
        client: string;
        league?: LeagueId;
        club?: string;
        season?: string;
        dryRun: boolean;
      }) => {
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

        if (options.season !== undefined && options.league !== undefined) {
          logger.error("subscription.failed", "--season only applies to --club, not --league");
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
          seasonName: options.season,
          dryRun: options.dryRun,
        });
        if (!result.ok) {
          logger.error("subscription.clubfailed", result.error.message, {
            cause: result.error.cause,
          });
          process.exitCode = 1;
          return;
        }

        const { club: matchedClub, leagues, season, subscriptionIds } = result.value;
        process.stdout.write(`Club: ${matchedClub.name} (${matchedClub.id})\n`);
        process.stdout.write(`Season: ${season.name}\n`);
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
      "Unsubscribe a client from a league by subscription id (find it via " +
        "`client list-subscriptions`). The league leaves the crawl's scope once no client " +
        "subscribes to it.",
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
      "Configure (or rotate) a followed club's webhook: after each crawl of a league that " +
        "club plays in and the client subscribes to, matchday POSTs " +
        "{ leagueId, hasChanges, crawledAt } to this URL, signed with a freshly minted secret " +
        "(X-Matchday-Signature: sha256=<hex>). Verify the signature over the raw body and read " +
        "leagueId from it. The secret is shown once here and never recoverable again — " +
        "re-running this rotates it. The client must already follow the club.",
    )
    .requiredOption("--client <name>", "the client name")
    .requiredOption("--club <name>", "the followed club to configure the webhook for")
    .requiredOption("--url <url>", "the http(s) endpoint to POST deliveries to")
    .action(async (options: { client: string; club: string; url: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runSetClientClubWebhookJob({
        logger,
        config,
        clientName: options.client,
        clubName: options.club,
        webhookUrl: options.url,
      });
      if (!result.ok) {
        logger.error("clientclub.webhookfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Club: ${result.value.club.name} (${result.value.club.id})\n`);
      process.stdout.write(`Webhook URL: ${result.value.webhookUrl}\n`);
      process.stdout.write(`Webhook secret: ${result.value.webhookSecret}\n`);
      process.stdout.write("Store this secret now — it will not be shown again.\n");
    });

  client
    .command("clear-webhook")
    .description("Remove a followed club's webhook so no further deliveries are sent for it.")
    .requiredOption("--client <name>", "the client name")
    .requiredOption("--club <name>", "the followed club to clear the webhook for")
    .action(async (options: { client: string; club: string }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runClearClientClubWebhookJob({
        logger,
        config,
        clientName: options.client,
        clubName: options.club,
      });
      if (!result.ok) {
        logger.error("clientclub.webhookclearfailed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`Cleared webhook for club: ${result.value.name}\n`);
    });

  const leagueTeam = program
    .command("league-team")
    .description("Maintenance for the league_team membership table.");

  leagueTeam
    .command("backfill")
    .description(
      "One-off: upsert a league_team row for every (league, team) pair already in table_entry, " +
        "for leagues crawled before the catalog crawl started writing league_team " +
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
