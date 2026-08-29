// Sync-subscriptions job: transport glue (AGENTS.md) — builds the real DB client and delegates
// the derive-and-diff to the service.

import { type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  deleteSubscription,
  findClientByName,
  findLatestSeason,
  findSeasonByName,
  listClientClubsByClientId,
  listLeaguesByClubId,
  listSubscriptionsWithLeague,
  upsertSubscription,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { syncSubscriptions, type SubscriptionSyncPlan } from "#services/subscriptionSyncService.ts";

export type RunSyncSubscriptionsJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  seasonName?: string;
  apply: boolean;
};

export async function runSyncSubscriptionsJob(
  input: RunSyncSubscriptionsJobInput,
): Promise<Result<SubscriptionSyncPlan>> {
  const { logger, config, clientName, seasonName, apply } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await syncSubscriptions({
    deps: {
      findClientByName: (name) => findClientByName(db, name),
      findLatestSeason: () => findLatestSeason(db),
      findSeasonByName: (name) => findSeasonByName(db, name),
      listClientClubsByClientId: (clientId) => listClientClubsByClientId(db, clientId),
      listLeaguesByClubId: (clubId, seasonId) => listLeaguesByClubId(db, clubId, seasonId),
      listSubscriptionsWithLeague: (filter) => listSubscriptionsWithLeague(db, filter),
      upsertSubscription: (values) => upsertSubscription(db, values),
      deleteSubscription: (id) => deleteSubscription(db, id),
    },
    clientName,
    seasonName,
    apply,
  });

  if (result.ok && result.value.applied) {
    logger.info("subscription.synced", "reconciled subscriptions against followed clubs", {
      clientName,
      season: result.value.season.name,
      added: result.value.additions.length,
      removed: result.value.removals.length,
    });
  }

  return result;
}
