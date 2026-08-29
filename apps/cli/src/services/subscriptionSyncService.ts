// Subscription reconciliation: derives what a client *should* be subscribed to from the clubs it
// follows, diffs that against what it *is* subscribed to, and (on apply) writes the difference.
// This is what turns a season rollover into one idempotent command rather than per-row surgery.

import { generateId, ok, type Result } from "@matchday/domain";
import type {
  deleteSubscription,
  listClientClubsByClientId,
  listSubscriptionsWithLeague,
  upsertSubscription,
} from "@matchday/db";
import { listLeaguesForClubId, type ClubLeagueServiceDeps } from "#services/clubLeagueService.ts";
import { resolveClient, type ClientResolverDeps } from "#services/clientResolver.ts";
import { resolveSeason, type SeasonResolverDeps } from "#services/seasonResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SubscriptionSyncDeps = ClientResolverDeps &
  SeasonResolverDeps &
  Pick<ClubLeagueServiceDeps, "listLeaguesByClubId"> & {
    listClientClubsByClientId: WithoutDb<typeof listClientClubsByClientId>;
    listSubscriptionsWithLeague: WithoutDb<typeof listSubscriptionsWithLeague>;
    upsertSubscription: WithoutDb<typeof upsertSubscription>;
    deleteSubscription: WithoutDb<typeof deleteSubscription>;
  };

/** A league to subscribe to, with the club that put it in scope — so the diff explains itself. */
export type SubscriptionAddition = {
  leagueId: string;
  leagueName: string;
  clubName: string;
};

/** An active subscription to drop, with the season it belongs to — the "why" is always that the
 * season is finished. */
export type SubscriptionRemoval = {
  subscriptionId: string;
  leagueId: string;
  leagueName: string;
  seasonName: string;
};

export type SubscriptionSyncPlan = {
  client: string;
  season: { id: string; name: string };
  clubs: string[];
  additions: SubscriptionAddition[];
  removals: SubscriptionRemoval[];
  /** Already-correct subscriptions, counted rather than listed — the diff is the interesting part. */
  unchangedCount: number;
  /** False on a plan-only run: nothing was written. */
  applied: boolean;
};

/** Leagues in the target season for every club the client follows, keyed by league id. A league
 * two followed clubs both play in is one subscription, credited to the first club by name. */
async function deriveTargetLeagues(
  deps: Pick<SubscriptionSyncDeps, "listLeaguesByClubId">,
  clubs: { clubId: string; clubName: string }[],
  seasonId: string,
): Promise<Result<Map<string, SubscriptionAddition>>> {
  const byLeagueId = new Map<string, SubscriptionAddition>();

  for (const club of clubs) {
    // Sequential, not Promise.all: a failure should stop the run rather than firing every
    // remaining query concurrently.
    const leaguesResult = await listLeaguesForClubId(deps, club.clubId, seasonId);
    if (!leaguesResult.ok) {
      return leaguesResult;
    }
    for (const league of leaguesResult.value) {
      if (!byLeagueId.has(league.id)) {
        byLeagueId.set(league.id, {
          leagueId: league.id,
          leagueName: league.name,
          clubName: club.clubName,
        });
      }
    }
  }

  return ok(byLeagueId);
}

export type SyncSubscriptionsInput = {
  deps: SubscriptionSyncDeps;
  clientName: string;
  /** Season year to sync to; defaults to the latest season we hold. */
  seasonName?: string;
  /** Write the diff. False plans it and writes nothing — the safe default, since a wrong club
   * list is a production data event. */
  apply: boolean;
};

/**
 * Reconcile a client's subscriptions against the clubs it follows, for one season.
 *
 * - **Add** every league a followed club plays in this season that the client isn't subscribed to.
 * - **Remove** active subscriptions whose league belongs to an *older* season.
 *
 * Removal is deliberately scoped to older seasons only, so a subscription added by hand for this
 * season (via `add-subscription --league`) survives a sync. Cleaning one of those up stays an
 * explicit `remove-subscription`.
 */
export async function syncSubscriptions(
  input: SyncSubscriptionsInput,
): Promise<Result<SubscriptionSyncPlan>> {
  const { deps, clientName, seasonName, apply } = input;

  const seasonResult = await resolveSeason(deps, seasonName);
  if (!seasonResult.ok) {
    return seasonResult;
  }
  const season = seasonResult.value;

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }
  const clientId = clientResult.value;

  const clubsResult = await deps.listClientClubsByClientId(clientId);
  if (!clubsResult.ok) {
    return clubsResult;
  }
  const clubs = clubsResult.value;

  const targetResult = await deriveTargetLeagues(deps, clubs, season.id);
  if (!targetResult.ok) {
    return targetResult;
  }
  const target = targetResult.value;

  const currentResult = await deps.listSubscriptionsWithLeague({ clientId });
  if (!currentResult.ok) {
    return currentResult;
  }
  const current = currentResult.value;

  const subscribedLeagueIds = new Set(current.map((row) => row.leagueId));
  const additions = [...target.values()]
    .filter((addition) => !subscribedLeagueIds.has(addition.leagueId))
    .sort((a, b) => a.leagueName.localeCompare(b.leagueName));

  // Season names are years, so a plain string comparison orders them — anything before the target
  // season is a finished season whose subscriptions are dead weight on the crawl.
  const removals = current
    .filter((row) => row.seasonName < season.name)
    .map((row) => ({
      subscriptionId: row.id,
      leagueId: row.leagueId,
      leagueName: row.leagueName,
      seasonName: row.seasonName,
    }));

  const plan: SubscriptionSyncPlan = {
    client: clientName,
    season: { id: season.id, name: season.name },
    clubs: clubs.map((club) => club.clubName),
    additions,
    removals,
    unchangedCount: current.length - removals.length,
    applied: false,
  };

  if (!apply) {
    return ok(plan);
  }

  for (const addition of additions) {
    const id = generateId("subscription");
    const upserted = await deps.upsertSubscription({
      id,
      clientId,
      leagueId: addition.leagueId,
    });
    if (!upserted.ok) {
      return upserted;
    }
  }

  for (const removal of removals) {
    const deleted = await deps.deleteSubscription(removal.subscriptionId);
    if (!deleted.ok) {
      return deleted;
    }
  }

  return ok({ ...plan, applied: true });
}
