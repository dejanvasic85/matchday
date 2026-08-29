// List-subscriptions job: transport glue (AGENTS.md). Resolves the client and season to ids so
// the filtering happens in SQL, never by handing the caller a full dump to grep.

import { ok, type Result } from "@matchday/domain";
import {
  createDbClient,
  findClientByName,
  findLatestSeason,
  findSeasonByName,
  listSubscriptionsWithLeague,
  type Db,
  type SubscriptionWithLeague,
} from "@matchday/db";
import type { CliConfig } from "#config.ts";
import { resolveClient } from "#services/clientResolver.ts";
import { resolveSeason } from "#services/seasonResolver.ts";

export type RunListSubscriptionsJobInput = {
  config: CliConfig;
  clientName: string;
  /** A season year to filter by. Omitted lists every season, so stale ones stay visible — the
   * whole point of the season column. */
  seasonName?: string;
};

/** `undefined` when no season was asked for, so the caller passes one filter shape either way. */
async function resolveSeasonId(
  db: Db,
  seasonName: string | undefined,
): Promise<Result<string | undefined>> {
  if (seasonName === undefined) {
    return ok(undefined);
  }
  const resolved = await resolveSeason(
    {
      findLatestSeason: () => findLatestSeason(db),
      findSeasonByName: (name) => findSeasonByName(db, name),
    },
    seasonName,
  );
  return resolved.ok ? ok(resolved.value.id) : resolved;
}

// No success logging: this job's output *is* what the CLI prints, so a log line would be noise
// interleaved with the table on stdout. Failures are logged by the caller.
export async function runListSubscriptionsJob(
  input: RunListSubscriptionsJobInput,
): Promise<Result<SubscriptionWithLeague[]>> {
  const { config, clientName, seasonName } = input;

  const db = createDbClient(config.DATABASE_URL);
  const clientId = await resolveClient(
    { findClientByName: (name) => findClientByName(db, name) },
    clientName,
  );
  if (!clientId.ok) {
    return clientId;
  }

  const seasonId = await resolveSeasonId(db, seasonName);
  if (!seasonId.ok) {
    return seasonId;
  }

  return listSubscriptionsWithLeague(db, {
    clientId: clientId.value,
    seasonId: seasonId.value,
  });
}
