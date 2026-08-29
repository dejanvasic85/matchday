// Create-subscriptions-for-club job: transport glue (AGENTS.md); onboarding a club is one
// call instead of one `add-subscription` per league.

import { type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  findClientByName,
  findClubsByName,
  findLatestSeason,
  findSeasonByName,
  listLeaguesByClubId,
  upsertClientClub,
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
  seasonName?: string;
  dryRun: boolean;
};

export async function runCreateSubscriptionsForClubJob(
  input: RunCreateSubscriptionsForClubJobInput,
): Promise<Result<ClubSubscriptionResult>> {
  const { logger, config, clientName, clubName, seasonName, dryRun } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await createSubscriptionsForClub({
    deps: {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      findLatestSeason: () => findLatestSeason(db),
      findSeasonByName: (name) => findSeasonByName(db, name),
      listLeaguesByClubId: (id, seasonId) => listLeaguesByClubId(db, id, seasonId),
      upsertClientClub: (values) => upsertClientClub(db, values),
      upsertSubscription: (values) => upsertSubscription(db, values),
    },
    clientName,
    clubName,
    seasonName,
    dryRun,
  });

  if (result.ok && !dryRun) {
    logger.info("subscription.clubcreated", "subscribed client to every resolved league", {
      clientName,
      clubId: result.value.club.id,
      clubName: result.value.club.name,
      season: result.value.season.name,
      leagueCount: result.value.leagues.length,
    });
  }

  return result;
}
