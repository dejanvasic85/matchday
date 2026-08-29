// Client-club webhook jobs: transport glue (AGENTS.md) — build the real DB client and delegate
// URL validation + secret minting to the service.

import { type Logger, type Result } from "@matchday/domain";
import {
  clearClientClubWebhook,
  createDbClient,
  findClientByName,
  findClubsByName,
  setClientClubWebhook,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  clearClientClubWebhook as clearWebhook,
  setClientClubWebhook as configureWebhook,
  type ConfiguredWebhook,
} from "#services/clientClubService.ts";
import type { ResolvedClub } from "#services/clubResolver.ts";

export type RunSetClientClubWebhookJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  clubName: string;
  webhookUrl: string;
};

export async function runSetClientClubWebhookJob(
  input: RunSetClientClubWebhookJobInput,
): Promise<Result<ConfiguredWebhook>> {
  const { logger, config, clientName, clubName, webhookUrl } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await configureWebhook(
    {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      setClientClubWebhook: (clientId, clubId, url, secret) =>
        setClientClubWebhook(db, clientId, clubId, url, secret),
    },
    clientName,
    clubName,
    webhookUrl,
  );

  if (result.ok) {
    logger.info("clientclub.webhookset", "club webhook configured", {
      clientName,
      clubName: result.value.club.name,
    });
  }

  return result;
}

export type RunClearClientClubWebhookJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  clubName: string;
};

export async function runClearClientClubWebhookJob(
  input: RunClearClientClubWebhookJobInput,
): Promise<Result<ResolvedClub>> {
  const { logger, config, clientName, clubName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await clearWebhook(
    {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      clearClientClubWebhook: (clientId, clubId) => clearClientClubWebhook(db, clientId, clubId),
    },
    clientName,
    clubName,
  );

  if (result.ok) {
    logger.info("clientclub.webhookcleared", "club webhook cleared", {
      clientName,
      clubName: result.value.name,
    });
  }

  return result;
}
