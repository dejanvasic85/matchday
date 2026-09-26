// List-club-leagues job: read-only discovery for onboarding — "which leagues does this
// club's teams actually play in?"

import { ok, type Result, type Source } from "@matchday/domain";
import {
  createDbClient,
  findClubsByName,
  findLatestSeason,
  findSeasonByName,
  listLeaguesByClubId,
  type Db,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { listLeaguesForClub, type ClubLeagues } from "#services/clubLeagueService.ts";
import { resolveSeason } from "#services/seasonResolver.ts";

/** `undefined` when no season was asked for, so the caller passes one argument shape either way. */
async function resolveSeasonId(
  db: Db,
  source: Source,
  seasonName: string | undefined,
): Promise<Result<string | undefined>> {
  if (seasonName === undefined) {
    return ok(undefined);
  }
  const resolved = await resolveSeason(
    {
      findLatestSeason: (seasonSource) => findLatestSeason(db, seasonSource),
      findSeasonByName: (seasonSource, name) => findSeasonByName(db, seasonSource, name),
    },
    source,
    seasonName,
  );
  return resolved.ok ? ok(resolved.value.id) : resolved;
}

export type RunListClubLeaguesJobInput = {
  config: CliConfig;
  clubName: string;
  source: Source;
  /** A season year to scope to. Omitted lists every season the club has ever played in — right
   * for browsing history, which is why `add-subscription` resolves a season instead. */
  seasonName?: string;
};

// No success logging: this job's output *is* what `mday club leagues` prints, same as
// listClients.
export async function runListClubLeaguesJob(
  input: RunListClubLeaguesJobInput,
): Promise<Result<ClubLeagues>> {
  const { config, clubName, source, seasonName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const seasonId = await resolveSeasonId(db, source, seasonName);
  if (!seasonId.ok) {
    return seasonId;
  }

  return listLeaguesForClub(
    {
      findClubsByName: (name) => findClubsByName(db, name),
      listLeaguesByClubId: (id, id2) => listLeaguesByClubId(db, id, id2),
    },
    clubName,
    seasonId.value,
  );
}
