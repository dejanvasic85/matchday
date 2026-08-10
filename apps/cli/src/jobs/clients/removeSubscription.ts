// Remove-subscription job (0012): transport glue (AGENTS.md) — builds the real DB client and
// delegates deletion to the subscription service.

import { type Logger, type Result, type SubscriptionId } from "@matchday/domain";
import { createDbClient, deleteSubscription } from "@matchday/db";
import type { CliConfig } from "@/src/config.ts";
import { removeSubscription } from "@/src/services/subscriptionService.ts";

export type RunRemoveSubscriptionJobInput = {
  logger: Logger;
  config: CliConfig;
  id: SubscriptionId;
};

export async function runRemoveSubscriptionJob(
  input: RunRemoveSubscriptionJobInput,
): Promise<Result<void>> {
  const { logger, config, id } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await removeSubscription(
    { deleteSubscription: (subscriptionId) => deleteSubscription(db, subscriptionId) },
    id,
  );

  if (result.ok) {
    logger.info("subscription.removed", "subscription removed", { id });
  }

  return result;
}
