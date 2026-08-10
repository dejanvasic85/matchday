// Create-subscription job (0012): transport glue (AGENTS.md) — builds the real DB client and
// delegates id generation + validation to the subscription service.

import { type LeagueId, type Logger, type Result, type SubscriptionId } from "@matchday/domain";
import {
  createDbClient,
  getLeagueById,
  upsertClientByName,
  upsertSubscription,
} from "@matchday/db";
import type { CliConfig } from "../config.ts";
import { createSubscription } from "../services/subscriptionService.ts";

export type RunCreateSubscriptionJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  leagueId: LeagueId;
};

export async function runCreateSubscriptionJob(
  input: RunCreateSubscriptionJobInput,
): Promise<Result<SubscriptionId>> {
  const { logger, config, clientName, leagueId } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await createSubscription({
    deps: {
      getLeagueById: (id) => getLeagueById(db, id),
      upsertSubscription: (values) => upsertSubscription(db, values),
      upsertClientByName: (values) => upsertClientByName(db, values),
    },
    clientName,
    leagueId,
  });

  if (result.ok) {
    logger.info("subscription.created", "subscription created", {
      id: result.value,
      clientName,
      leagueId,
    });
  }

  return result;
}
