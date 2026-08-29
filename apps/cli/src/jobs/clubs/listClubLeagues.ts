// List-club-leagues job: read-only discovery for onboarding — "which leagues does this
// club's teams actually play in?"

import { type Result } from "@matchday/domain";
import { createDbClient, findClubsByName, listLeaguesByClubId } from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listLeaguesForClub, type ClubLeagues } from "#services/clubLeagueService.ts";

export type RunListClubLeaguesJobInput = {
  config: CliConfig;
  clubName: string;
};

// No success logging: this job's output *is* what `mday club leagues` prints, same as
// listClients.
export async function runListClubLeaguesJob(
  input: RunListClubLeaguesJobInput,
): Promise<Result<ClubLeagues>> {
  const { config, clubName } = input;

  const db = createDbClient(config.DATABASE_URL);
  return listLeaguesForClub(
    {
      findClubsByName: (name) => findClubsByName(db, name),
      listLeaguesByClubId: (id) => listLeaguesByClubId(db, id),
    },
    clubName,
  );
}
