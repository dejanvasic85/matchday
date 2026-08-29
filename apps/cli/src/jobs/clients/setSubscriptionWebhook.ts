// Set-subscription-webhook job: transport glue (AGENTS.md) — builds the real DB client and
// delegates URL validation + secret minting to the service.

import { type Logger, type Result, type SubscriptionId } from "@matchday/domain";
import { createDbClient, setSubscriptionWebhook } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  setSubscriptionWebhook as configureSubscriptionWebhook,
  type ConfiguredWebhook,
} from "#services/subscriptionService.ts";

export type RunSetSubscriptionWebhookJobInput = {
  logger: Logger;
  config: CliConfig;
  id: SubscriptionId;
  webhookUrl: string;
};

export async function runSetSubscriptionWebhookJob(
  input: RunSetSubscriptionWebhookJobInput,
): Promise<Result<ConfiguredWebhook>> {
  const { logger, config, id, webhookUrl } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await configureSubscriptionWebhook(
    {
      setSubscriptionWebhook: (subscriptionId, url, secret) =>
        setSubscriptionWebhook(db, subscriptionId, url, secret),
    },
    id,
    webhookUrl,
  );

  if (result.ok) {
    logger.info("subscription.webhookset", "subscription webhook configured", { id });
  }

  return result;
}
