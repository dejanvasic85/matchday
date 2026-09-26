// Subscription reconciliation: derives the leagues a client should follow, diffs them against
// what it is subscribed to, and (on apply) writes the difference. Seasons resolve per club.

import {
  badRequest,
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
  season: { id: string; name: string } | null;
  clubs: string[];
  additions: SubscriptionAddition[];
  removals: SubscriptionRemoval[];
  /** Already-correct subscriptions, counted rather than listed — the diff is the interesting part. */
  unchangedCount: number;
  /** False on a plan-only run: nothing was written. */
  applied: boolean;
};

/** Leagues the followed clubs play in, keyed by league id. Scoped to one season when `seasonId`
 * is set, otherwise every season the club has history in; finished seasons are skipped. */
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
      const finished = seasonId === undefined && hasSeasonFinished(league.seasonEndsOn, today);
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

/**
 * Reconcile a client's subscriptions against the clubs it follows: add every league a followed
 * club plays in, and remove subscriptions whose season has ended. Plans only unless `apply`.
 */
export async function syncSubscriptions(
  input: SyncSubscriptionsInput,
): Promise<Result<SubscriptionSyncPlan>> {
  const { deps, clientName, seasonName, apply } = input;
  const today = input.today ?? todayInMelbourne();

  // Resolve a pinned season first: an unknown `--season` is a typo that should fail before any
  // client or club lookup, and the CLI's other commands order it the same way.
  let pinnedSeasonId: string | undefined;
  let pinnedSeason: { id: string; name: string } | null = null;
  if (seasonName !== undefined) {
    const seasonResult = await resolveSeason(deps, seasonName);
    if (!seasonResult.ok) {
      return seasonResult;
    }
    // A pin on a finished season would re-add leagues the next unpinned run prunes — flap. Fail
    // instead of writing rows we know are immediately stale.
    if (hasSeasonFinished(seasonResult.value.endsOn, today)) {
      return badRequest(
        `Season "${seasonResult.value.name}" finished on ${seasonResult.value.endsOn} — nothing to sync`,
      );
    }
    pinnedSeasonId = seasonResult.value.id;
    pinnedSeason = { id: seasonResult.value.id, name: seasonResult.value.name };
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

  // Unpinned, the target is every league the followed clubs have ever played in, so a second
  // source's season is never dragged in. `undefined` reads as "all seasons" in the query.
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
    season: pinnedSeason,
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
