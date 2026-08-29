// Clear-subscription-webhook job: transport glue (AGENTS.md) — builds the real DB client
// and delegates the clear to the service.

import { type Logger, type Result, type SubscriptionId } from "@matchday/domain";
import { clearSubscriptionWebhook, createDbClient } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { clearSubscriptionWebhook as clearConfiguredWebhook } from "#services/subscriptionService.ts";

export type RunClearSubscriptionWebhookJobInput = {
  logger: Logger;
  config: CliConfig;
  id: SubscriptionId;
};

export async function runClearSubscriptionWebhookJob(
  input: RunClearSubscriptionWebhookJobInput,
): Promise<Result<void>> {
  const { logger, config, id } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await clearConfiguredWebhook(
    { clearSubscriptionWebhook: (subscriptionId) => clearSubscriptionWebhook(db, subscriptionId) },
    id,
  );

  if (result.ok) {
    logger.info("subscription.webhookcleared", "subscription webhook cleared", { id });
  }

  return result;
}
