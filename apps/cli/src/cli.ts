#!/usr/bin/env node
// `mday` — the crawler CLI. Thin commander wiring: each command constructs real
// dependencies (config, logger) and calls the matching job in src/jobs.

import {
  createConsoleLogger,
  parseId,
  type ApiTokenId,
  type CrawlTargetId,
  type LeagueId,
} from "@matchday/domain";
import { Command, InvalidArgumentError, Option } from "commander";
import { renderApiTokenTable } from "#apiTokenTable.ts";
import { renderClientTable } from "#clientTable.ts";
import { renderCrawlTargetTable } from "#crawlTargetTable.ts";
import { renderSeasonTable } from "#seasonTable.ts";
import { renderClubLeagueTable } from "#clubLeagueTable.ts";
import { getCliConfig } from "#config.ts";
import { crawlSourceValue, type CrawlSource } from "#crawlers/constants.ts";
import { runCatalogJob } from "#jobs/crawls/catalog.ts";
import { runCountCatalogLeaguesJob } from "#jobs/crawls/countCatalogLeagues.ts";
import { runAddCrawlTargetJob } from "#jobs/crawlTargets/addCrawlTarget.ts";
import { runListCrawlTargetsJob } from "#jobs/crawlTargets/listCrawlTargets.ts";
import {
  runRemoveCrawlTargetJob,
  type RemoveCrawlTargetTarget,
} from "#jobs/crawlTargets/removeCrawlTarget.ts";
import { runClubEnrichmentJob } from "#jobs/clubs/enrichClubs.ts";
import { runListClubLeaguesJob } from "#jobs/clubs/listClubLeagues.ts";
import { runListApiTokenUsageJob } from "#jobs/clients/apiTokenUsage.ts";
import { runCreateApiTokenJob } from "#jobs/clients/createApiToken.ts";
import { runCreateClientJob } from "#jobs/clients/createClient.ts";
import {
  runClearClientClubWebhookJob,
  runSetClientClubWebhookJob,
} from "#jobs/clients/clientClubWebhook.ts";
import { runFollowClubJob, runUnfollowClubJob } from "#jobs/clients/followClub.ts";
import { runCrawlLeaguesJob } from "#jobs/crawls/crawlLeagues.ts";
import { runListClientsJob } from "#jobs/clients/listClients.ts";
import { runBackfillLeagueTeamsJob } from "#jobs/maintenance/backfillLeagueTeams.ts";
import { runRevokeApiTokenJob } from "#jobs/clients/revokeApiToken.ts";
import { runListSeasonsJob } from "#jobs/seasons/listSeasons.ts";
import { runSetSeasonDatesJob } from "#jobs/seasons/setSeasonDates.ts";
import { describeSeasonDatesFailure } from "#services/seasonDateService.ts";
import {
  describeAddCrawlTargetFailure,
  describeRemoveCrawlTargetFailure,
} from "#services/crawlTargetService.ts";
import { runCrawlScopeJob } from "#jobs/crawls/crawlScope.ts";

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

function collectLeagueId(value: string, previous: LeagueId[] = []): LeagueId[] {
  return [...previous, parseLeagueId(value)];
}

function parseApiTokenId(value: string): ApiTokenId {
  const id = parseId(value, "apiToken");
  if (id === undefined) {
    throw new InvalidArgumentError('must be a "tok_"-prefixed api token id');
  }
  return id;
}

function parseCrawlTargetId(value: string): CrawlTargetId {
  const id = parseId(value, "crawlTarget");
  if (id === undefined) {
    throw new InvalidArgumentError('must be a "crt_"-prefixed crawl target id');
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

/** A `--source` selector for commands that resolve a season. Seasons are scoped to a source, so a
 * season name alone is ambiguous. Returns a fresh `Option` per call: commander mutates the
 * instance it is given. */
function seasonSourceOption(description?: string): Option {
  return new Option(
    "--source <name>",
    description ?? `source whose seasons to use (${crawlSources.join(", ")})`,
  )
    .argParser(parseCrawlSource)
    .default(crawlSourceValue.dribl);
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
      "List the league ids in the crawl scope for this run, as JSON — the scope the crawl-leagues " +
        "GitHub Actions matrix crawls each run. Each crawl target resolves to its competition's " +
        "current season; a target with no league to crawl is warn-logged and skipped. With " +
        "--max-chunks, also deals them into that many space-separated groups, one per matrix job.",
    )
    .option(
      "--max-chunks <n>",
      "cap the league ids into at most n groups, one per crawl-leagues matrix job",
      parsePositiveInt,
    )
    .action(async (options: { maxChunks?: number }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCrawlScopeJob({
        logger,
        config,
        maxChunks: options.maxChunks,
      });
      if (!result.ok) {
        logger.error("crawlscope.failed", result.error.message, {
          cause: result.error.cause,
        });
        process.exitCode = 1;
      }
    });

  program
    .command("crawl-leagues")
    .description(
      "Crawl fixtures + table for one or more leagues in the crawl scope, discovering clubs/teams " +
        "and persisting via entity resolution. Leagues given together share one browser session " +
        "and are crawled in order; one failing league does not stop the rest, but does fail the " +
        "command. Expensive; run at a cadence derived from fixture dates. Omit --league to crawl " +
        "every league the source maintains itself (coastal does; dribl needs explicit ids).",
    )
    .option(
      "--source <name>",
      `source to crawl (${crawlSources.join(", ")})`,
      parseCrawlSource,
      crawlSourceValue.dribl,
    )
    .option(
      "--league <lea_id>",
      "a league id to crawl; repeat the flag to crawl several in one browser session",
      collectLeagueId,
    )
    .option(
      "--dry-run",
      "crawl and stage to R2, logging a summary, without writing to the database",
      false,
    )
    .action(async (options: { source: CrawlSource; league?: LeagueId[]; dryRun: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runCrawlLeaguesJob({
        logger,
        config,
        source: options.source,
        leagueIds: options.league ?? [],
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
    .addOption(seasonSourceOption())
    .option("--season <year>", "only show leagues in this season (default: all seasons)")
    .option("--json", "print the result as JSON instead of a table", false)
    .action(
      async (name: string, options: { source: CrawlSource; season?: string; json: boolean }) => {
        const config = getCliConfig();
        const logger = createConsoleLogger();
        const result = await runListClubLeaguesJob({
          config,
          clubName: name,
          source: options.source,
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
      },
    );

  const client = program
    .command("client")
    .description(
      "Manage API consumers: the clients themselves, the clubs they follow, their bearer " +
        "tokens, and each followed club's optional post-crawl webhook.",
    );

  client
    .command("list")
    .description(
      "List every client with its active token count, followed clubs, and whether each followed " +
        "club has a webhook.",
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
    .command("list-tokens")
    .description(
      "List one client's tokens with when each was issued, when it last authenticated a " +
        "request, and a status: unused (never called), idle (nothing for 90 days — safe to " +
        "revoke), active, or revoked. A token past a year old is also flagged for renewal. " +
        "Last use is stamped at most hourly, so it can lag live traffic by that much.",
    )
    .argument("<name>", "the client name")
    .option("--json", "print the tokens as JSON instead of a table", false)
    .action(async (name: string, options: { json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListApiTokenUsageJob({ config, clientName: name });
      if (!result.ok) {
        logger.error("apitoken.listfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderApiTokenTable(result.value);
      process.stdout.write(`${output}\n`);
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
      "Record that a client follows a club. The follow owns the post-crawl webhook. It never " +
        "widens the crawl — which leagues we crawl is set separately with `mday crawl-target`.",
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
    });

  client
    .command("unfollow-club")
    .description("Stop a client following a club. Any webhook on the follow goes with it.")
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
    .command("set-webhook")
    .description(
      "Configure (or rotate) a followed club's webhook: after each crawl of a league that " +
        "club plays in, matchday POSTs " +
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

  const season = program
    .command("season")
    .description("Season calendar windows, used to work out which season is current.");

  season
    .command("list")
    .description(
      "List each season window: the source, the season, the competition that runs it, and its " +
        "start/end dates. A window still missing dates is obvious before the crawl relies on it. " +
        "--json prints the rows alone for piping into jq.",
    )
    .option(
      "--source <name>",
      `only show this source's seasons (${crawlSources.join(", ")})`,
      parseCrawlSource,
    )
    .option("--json", "print the rows as JSON instead of a table", false)
    .action(async (options: { source?: CrawlSource; json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListSeasonsJob({ config, source: options.source });
      if (!result.ok) {
        logger.error("season.listfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderSeasonTable(result.value);
      process.stdout.write(`${output}\n`);
    });

  season
    .command("set-dates")
    .description(
      "Set a competition's season window (YYYY-MM-DD). Run this after `mday catalog` has created " +
        "the season and competition — Dribl names seasons by year but gives no dates, so they are " +
        "entered by hand here, one window per competition. Both dates are required; a sync treats " +
        "a window as finished only once today is past its end date, so a window with no end date " +
        "is never pruned.",
    )
    .argument("<name>", "the season name (a year, e.g. 2026)")
    .requiredOption("--competition <name>", "the competition whose window to set")
    .requiredOption("--starts <date>", "the window's first day, as YYYY-MM-DD")
    .requiredOption("--ends <date>", "the window's last day, as YYYY-MM-DD")
    .addOption(seasonSourceOption())
    .action(
      async (
        name: string,
        options: { competition: string; starts: string; ends: string; source: CrawlSource },
      ) => {
        const config = getCliConfig();
        const logger = createConsoleLogger();
        const result = await runSetSeasonDatesJob({
          logger,
          config,
          source: options.source,
          seasonName: name,
          competitionName: options.competition,
          startsOn: options.starts,
          endsOn: options.ends,
        });
        if (!result.ok) {
          logger.error("season.setdatesfailed", result.error.message, {
            cause: result.error.cause,
          });
          process.exitCode = 1;
          return;
        }
        if (result.value.status !== "written") {
          const failure = describeSeasonDatesFailure(
            result.value,
            options.source,
            name,
            options.competition,
          );
          logger.error("season.setdatesfailed", failure.message, { hint: failure.hint });
          process.exitCode = 1;
          return;
        }
        process.stdout.write(
          `${result.value.source} ${result.value.seasonName} / ${result.value.competitionName}: ` +
            `${result.value.startsOn} → ${result.value.endsOn}\n`,
        );
      },
    );

  const crawlTarget = program
    .command("crawl-target")
    .description(
      "Manage the leagues the system crawls. This is the system's crawl scope, separate from " +
        "what any client follows.",
    );

  crawlTarget
    .command("add")
    .description(
      "Add a league to the crawl scope. The competition and league are matched by exact name " +
        "from the source, so run `mday catalog` first and check names with `mday season list`. " +
        "The league name must already exist under the competition: adding it stores the exact " +
        "text the crawl looks up again, so a typo fails instead of silently never matching.",
    )
    .requiredOption("--competition <name>", "the competition whose league to crawl (exact name)")
    .requiredOption("--league <name>", "the league to crawl (exact name under that competition)")
    .addOption(seasonSourceOption("the source whose competition to target"))
    .action(async (options: { competition: string; league: string; source: CrawlSource }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runAddCrawlTargetJob({
        logger,
        config,
        source: options.source,
        competitionName: options.competition,
        leagueName: options.league,
      });
      if (!result.ok) {
        logger.error("crawltarget.addfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      if (result.value.status !== "added") {
        const failure = describeAddCrawlTargetFailure(
          result.value,
          options.source,
          options.competition,
          options.league,
        );
        logger.error("crawltarget.addfailed", failure.message, { hint: failure.hint });
        process.exitCode = 1;
        return;
      }
      process.stdout.write(
        `Added crawl target: ${result.value.competitionName} / ${result.value.leagueName} ` +
          `(${result.value.id})\n`,
      );
    });

  crawlTarget
    .command("list")
    .description(
      "List the crawl scope: each target's id, competition and league. --json prints the rows " +
        "alone for piping into jq.",
    )
    .option("--json", "print the rows as JSON instead of a table", false)
    .action(async (options: { json: boolean }) => {
      const config = getCliConfig();
      const logger = createConsoleLogger();
      const result = await runListCrawlTargetsJob({ config });
      if (!result.ok) {
        logger.error("crawltarget.listfailed", result.error.message, { cause: result.error.cause });
        process.exitCode = 1;
        return;
      }
      const output = options.json
        ? JSON.stringify(result.value, null, 2)
        : renderCrawlTargetTable(result.value);
      process.stdout.write(`${output}\n`);
    });

  crawlTarget
    .command("remove")
    .description(
      "Remove a crawl target by its `crt_` id, or by its competition and league names. Provide " +
        "either --id, or both --competition and --league.",
    )
    .option("--id <id>", "the target id to remove", parseCrawlTargetId)
    .option("--competition <name>", "the competition the league belongs to (with --league)")
    .option("--league <name>", "the league to stop crawling (with --competition)")
    .addOption(seasonSourceOption("the source whose competition to match (with --league)"))
    .action(
      async (options: {
        id?: CrawlTargetId;
        competition?: string;
        league?: string;
        source: CrawlSource;
      }) => {
        const config = getCliConfig();
        const logger = createConsoleLogger();
        const { id, competition, league, source } = options;

        let target: RemoveCrawlTargetTarget;
        if (id !== undefined && (competition !== undefined || league !== undefined)) {
          logger.error(
            "crawltarget.removefailed",
            "Provide either --id, or the --competition and --league pair, not both",
          );
          process.exitCode = 1;
          return;
        } else if (id !== undefined) {
          target = { kind: "id", id };
        } else if (competition !== undefined && league !== undefined) {
          target = { kind: "league", source, competitionName: competition, leagueName: league };
        } else {
          logger.error(
            "crawltarget.removefailed",
            "Provide either --id, or both --competition and --league",
          );
          process.exitCode = 1;
          return;
        }

        const result = await runRemoveCrawlTargetJob({ logger, config, target });
        if (!result.ok) {
          logger.error("crawltarget.removefailed", result.error.message, {
            cause: result.error.cause,
          });
          process.exitCode = 1;
          return;
        }
        if (result.value.status !== "removed") {
          if (target.kind === "id") {
            logger.error("crawltarget.removefailed", `No crawl target with id "${target.id}"`);
          } else {
            const failure = describeRemoveCrawlTargetFailure(
              result.value,
              target.source,
              target.competitionName,
              target.leagueName,
            );
            logger.error("crawltarget.removefailed", failure.message, { hint: failure.hint });
          }
          process.exitCode = 1;
          return;
        }
        process.stdout.write(`Removed crawl target: ${result.value.id}\n`);
      },
    );

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
