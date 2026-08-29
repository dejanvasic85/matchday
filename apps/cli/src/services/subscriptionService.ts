// Subscription creation: a client subscribes to one of our leagues — validates the league
// exists, mints the id, and delegates the write to data-access.

import {
  generateId,
  notFound,
  ok,
  parseId,
  serverError,
  type LeagueId,
  type Result,
  type SubscriptionId,
} from "@matchday/domain";
import type {
  deleteSubscription,
  getLeagueById,
  upsertClientClub,
  upsertSubscription,
} from "@matchday/db";
import {
  listLeaguesForClub,
  type ClubLeagueServiceDeps,
  type ClubLeagues,
} from "#services/clubLeagueService.ts";
import { resolveClient, type ClientResolverDeps } from "#services/clientResolver.ts";
import { resolveSeason, type SeasonResolverDeps } from "#services/seasonResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SubscriptionServiceDeps = ClientResolverDeps &
  ClubLeagueServiceDeps &
  SeasonResolverDeps & {
    getLeagueById: WithoutDb<typeof getLeagueById>;
    upsertSubscription: WithoutDb<typeof upsertSubscription>;
    deleteSubscription: WithoutDb<typeof deleteSubscription>;
    upsertClientClub: WithoutDb<typeof upsertClientClub>;
  };

function toSubscriptionId(id: string): Result<SubscriptionId> {
  const subscriptionId = parseId(id, "subscription");
  if (subscriptionId === undefined) {
    return serverError(`Subscription row id "${id}" doesn't have the expected "sub_" prefix`);
  }
  return ok(subscriptionId);
}

export type CreateSubscriptionInput = {
  deps: Pick<SubscriptionServiceDeps, "getLeagueById" | "upsertSubscription" | "findClientByName">;
  clientName: string;
  leagueId: LeagueId;
};

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<Result<SubscriptionId>> {
  const { deps, clientName, leagueId } = input;

  const leagueResult = await deps.getLeagueById(leagueId);
  if (!leagueResult.ok) {
    return leagueResult;
  }
  if (leagueResult.value === null) {
    return notFound(`League not found: ${leagueId}`);
  }

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  // Re-subscribing conflicts on (client, league) and keeps the original row's id, so return what
  // came back rather than what we minted, or the caller prints an id that was never persisted.
  const id = generateId("subscription");
  const upserted = await deps.upsertSubscription({ id, clientId: clientResult.value, leagueId });
  if (!upserted.ok) {
    return upserted;
  }

  return toSubscriptionId(upserted.value.id);
}

export type CreateSubscriptionsForClubInput = {
  deps: Pick<
    SubscriptionServiceDeps,
    | "findClientByName"
    | "findClubsByName"
    | "findLatestSeason"
    | "findSeasonByName"
    | "listLeaguesByClubId"
    | "upsertClientClub"
    | "upsertSubscription"
  >;
  clientName: string;
  clubName: string;
  /** Season year to subscribe for; defaults to the latest season we hold. */
  seasonName?: string;
  /** Resolve the club and its leagues without writing anything — the safe-by-default habit for a
   * fuzzy club match: a typo'd `--club` is a prod-data event otherwise. */
  dryRun: boolean;
};

export type ClubSubscriptionResult = ClubLeagues & {
  season: { id: string; name: string };
  /** Empty on a dry run — nothing was written. */
  subscriptionIds: SubscriptionId[];
};

/** Subscribe a client to every league a club plays in *this season*, and record that the client
 * follows the club so a later `sync-subscriptions` can re-derive the same set for a new season.
 * Resolves the club and season before the client, so an ambiguous or typo'd `--club` fails before
 * any write is attempted, dry run or not. */
export async function createSubscriptionsForClub(
  input: CreateSubscriptionsForClubInput,
): Promise<Result<ClubSubscriptionResult>> {
  const { deps, clientName, clubName, seasonName, dryRun } = input;

  const seasonResult = await resolveSeason(deps, seasonName);
  if (!seasonResult.ok) {
    return seasonResult;
  }
  const season = seasonResult.value;

  const clubLeaguesResult = await listLeaguesForClub(deps, clubName, season.id);
  if (!clubLeaguesResult.ok) {
    return clubLeaguesResult;
  }
  const { club, leagues } = clubLeaguesResult.value;

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  if (dryRun) {
    return ok({ club, leagues, season, subscriptionIds: [] });
  }

  // Record the follow first: if a later upsert fails, the provenance is still there and a
  // `sync-subscriptions` finishes the job.
  const followed = await deps.upsertClientClub({
    id: generateId("clientClub"),
    clientId: clientResult.value,
    clubId: club.id,
  });
  if (!followed.ok) {
    return followed;
  }

  const subscriptionIds: SubscriptionId[] = [];
  for (const league of leagues) {
    const id = generateId("subscription");
    // Sequential, not Promise.all: a failure should stop the run rather than firing every
    // remaining upsert concurrently.
    const upserted = await deps.upsertSubscription({
      id,
      clientId: clientResult.value,
      leagueId: league.id,
    });
    if (!upserted.ok) {
      return upserted;
    }
    const subscriptionId = toSubscriptionId(upserted.value.id);
    if (!subscriptionId.ok) {
      return subscriptionId;
    }
    subscriptionIds.push(subscriptionId.value);
  }

  return ok({ club, leagues, season, subscriptionIds });
}

/** Soft-delete a subscription, narrowing an unknown (or already-removed) id to a `notFound`
 * outcome so the CLI reports a bad id rather than exiting 0 on a no-op. */
export async function removeSubscription(
  deps: Pick<SubscriptionServiceDeps, "deleteSubscription">,
  id: SubscriptionId,
): Promise<Result<void>> {
  const deleted = await deps.deleteSubscription(id);
  if (!deleted.ok) {
    return deleted;
  }
  if (deleted.value === null) {
    return notFound(`Subscription not found: ${id}`);
  }
  return ok(undefined);
}
