// Create-subscriptions-for-club job (#85): transport glue (AGENTS.md); onboarding a club is one
// call instead of one `add-subscription` per league.

import { type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  findClientByName,
  findClubsByName,
  listLeaguesByClubId,
  upsertSubscription,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import {
  createSubscriptionsForClub,
  type ClubSubscriptionResult,
} from "#services/subscriptionService.ts";

export type RunCreateSubscriptionsForClubJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  clubName: string;
  dryRun: boolean;
};

export async function runCreateSubscriptionsForClubJob(
  input: RunCreateSubscriptionsForClubJobInput,
): Promise<Result<ClubSubscriptionResult>> {
  const { logger, config, clientName, clubName, dryRun } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await createSubscriptionsForClub({
    deps: {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      listLeaguesByClubId: (id) => listLeaguesByClubId(db, id),
      upsertSubscription: (values) => upsertSubscription(db, values),
    },
    clientName,
    clubName,
    dryRun,
  });

  if (result.ok && !dryRun) {
    logger.info("subscription.clubcreated", "subscribed client to every resolved league", {
      clientName,
      clubId: result.value.club.id,
      clubName: result.value.club.name,
      leagueCount: result.value.leagues.length,
    });
  }

  return result;
}
