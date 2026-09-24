// Subscription reconciliation: derives the leagues a client should follow, diffs them against
// what it is subscribed to, and (on apply) writes the difference. Seasons resolve per club.

import {
  generateId,
  hasSeasonFinished,
  ok,
  todayInMelbourne,
  type IsoDate,
  type Result,
} from "@matchday/domain";
import type {
  deleteSubscription,
  listClientClubsByClientId,
  listSubscriptionsWithLeague,
  SubscriptionWithLeague,
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
  /** The season the sync was pinned to, or `null` when it reconciled across every season the
   * followed clubs play in. */
  seasonId: string | null;
  clubs: string[];
  additions: SubscriptionAddition[];
  removals: SubscriptionRemoval[];
  /** Already-correct subscriptions, counted rather than listed — the diff is the interesting part. */
  unchangedCount: number;
  /** False on a plan-only run: nothing was written. */
  applied: boolean;
};

/** Leagues the followed clubs play in, keyed by league id — scoped to one season when `seasonId`
 * is set, otherwise every season the club has history in. A league two followed clubs both play in
 * is one subscription, credited to the first club by name. */
async function deriveTargetLeagues(
  deps: Pick<SubscriptionSyncDeps, "listLeaguesByClubId">,
  clubs: { clubId: string; clubName: string }[],
  seasonId: string | undefined,
  today: IsoDate,
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
      // Pinned scope is explicit, so honour it; unpinned, skip a season that already ended or we
      // would re-subscribe the very leagues the removals below just pruned.
      const finished =
        seasonId === undefined && hasSeasonFinished(league.seasonEndsOn ?? null, today);
      if (!finished && !byLeagueId.has(league.id)) {
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
  /** Season name (a year like `"2026"`) to sync to. Omitted reconciles across every season the
   * followed clubs play in — the per-club default, which never targets another source's season. */
  seasonName?: string;
  /** Write the diff. False plans it and writes nothing — the safe default, since a wrong club
   * list is a production data event. */
  apply: boolean;
  /** Injected for testability; defaults to the real Melbourne "today". */
  today?: IsoDate;
};

/**
 * Reconcile a client's subscriptions against the clubs it follows.
 *
 * - **Add** every league a followed club plays in the target season(s) that the client isn't
 *   subscribed to.
 * - **Remove** active subscriptions whose season has finished — its `ends_on` is before today.
 *
 * The target season(s) are derived per club: unless `seasonName` pins one, they are the seasons
 * the followed clubs' leagues belong to. That keeps a second source's season out of a Dribl
 * client's target set, where a global "latest season" would have pruned live subscriptions.
 *
 * Removal is date-based, not name-based: a subscription is only dropped once its league's season
 * has ended. A season with no `ends_on` is never finished, so a hand-set subscription on an
 * undated season survives every sync until its dates are known.
 *
 * Subscriptions are derived state, so `remove-subscription` on a *followed* club's current-season
 * league is undone by the next sync. Unfollow the club to drop it for good.
 *
 * Additions are written before removals, and a failed write returns immediately — leaving the
 * earlier writes in place. Every write is an idempotent upsert, so re-running finishes the job.
 */
/** The active subscriptions whose season has finished — the ones the sync prunes. */
function planRemovals(current: SubscriptionWithLeague[], today: IsoDate): SubscriptionRemoval[] {
  return current
    .filter((row) => hasSeasonFinished(row.seasonEndsOn, today))
    .map((row) => ({
      subscriptionId: row.id,
      leagueId: row.leagueId,
      leagueName: row.leagueName,
      seasonName: row.seasonName,
    }));
}

/** Write a plan's additions then removals. Additions first so a failed write leaves the diff
 * partially applied but never prunes a league it failed to replace. Every write is idempotent. */
async function applyPlan(
  deps: SubscriptionSyncDeps,
  clientId: string,
  additions: SubscriptionAddition[],
  removals: SubscriptionRemoval[],
): Promise<Result<void>> {
  for (const addition of additions) {
    const upserted = await deps.upsertSubscription({
      id: generateId("subscription"),
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

  return ok(undefined);
}

export async function syncSubscriptions(
  input: SyncSubscriptionsInput,
): Promise<Result<SubscriptionSyncPlan>> {
  const { deps, clientName, seasonName, apply } = input;
  const today = input.today ?? todayInMelbourne();

  // Resolve a pinned season first: an unknown `--season` is a typo that should fail before any
  // client or club lookup, and the CLI's other commands order it the same way.
  let pinnedSeasonId: string | undefined;
  if (seasonName !== undefined) {
    const seasonResult = await resolveSeason(deps, seasonName);
    if (!seasonResult.ok) {
      return seasonResult;
    }
    pinnedSeasonId = seasonResult.value.id;
  }

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

  // Unpinned, the target is every league the followed clubs have ever played in — their own
  // history bounds it, so a second source's season is never dragged in. `seasonId` is undefined
  // for that case, which the league query reads as "all seasons".
  const targetResult = await deriveTargetLeagues(deps, clubs, pinnedSeasonId, today);
  if (!targetResult.ok) {
    return targetResult;
  }

  const currentResult = await deps.listSubscriptionsWithLeague({ clientId });
  if (!currentResult.ok) {
    return currentResult;
  }
  const current = currentResult.value;

  const subscribedLeagueIds = new Set(current.map((row) => row.leagueId));
  const additions = [...targetResult.value.values()]
    .filter((addition) => !subscribedLeagueIds.has(addition.leagueId))
    .sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  const removals = planRemovals(current, today);

  const plan: SubscriptionSyncPlan = {
    client: clientName,
    seasonId: pinnedSeasonId ?? null,
    clubs: clubs.map((club) => club.clubName),
    additions,
    removals,
    unchangedCount: current.length - removals.length,
    applied: false,
  };

  if (!apply) {
    return ok(plan);
  }

  const applied = await applyPlan(deps, clientId, additions, removals);
  return applied.ok ? ok({ ...plan, applied: true }) : applied;
}
