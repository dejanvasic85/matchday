// Follow/unfollow-club jobs: transport glue (AGENTS.md) — build the real DB client and delegate
// the club/client resolution to the service.

import { type Logger, type Result } from "@matchday/domain";
import {
  createDbClient,
  deleteClientClub,
  findClientByName,
  findClubsByName,
  upsertClientClub,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { followClub, unfollowClub, type FollowedClub } from "#services/clientClubService.ts";

export type RunFollowClubJobInput = {
  logger: Logger;
  config: CliConfig;
  clientName: string;
  clubName: string;
};

export async function runFollowClubJob(
  input: RunFollowClubJobInput,
): Promise<Result<FollowedClub>> {
  const { logger, config, clientName, clubName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await followClub(
    {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      upsertClientClub: (values) => upsertClientClub(db, values),
    },
    clientName,
    clubName,
  );

  if (result.ok) {
    logger.info("clientclub.followed", "client now follows club", {
      clientName,
      clubId: result.value.club.id,
      clubName: result.value.club.name,
    });
  }

  return result;
}

export async function runUnfollowClubJob(
  input: RunFollowClubJobInput,
): Promise<Result<FollowedClub>> {
  const { logger, config, clientName, clubName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const result = await unfollowClub(
    {
      findClientByName: (name) => findClientByName(db, name),
      findClubsByName: (name) => findClubsByName(db, name),
      deleteClientClub: (clientId, clubId) => deleteClientClub(db, clientId, clubId),
    },
    clientName,
    clubName,
  );

  if (result.ok) {
    logger.info("clientclub.unfollowed", "client no longer follows club", {
      clientName,
      clubId: result.value.club.id,
      clubName: result.value.club.name,
    });
  }

  return result;
}
