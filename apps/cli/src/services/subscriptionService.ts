// Subscription creation (0012): a client subscribes to one of our leagues. Business logic lives
// here (AGENTS.md) — validates the league exists, mints the id, and delegates the write to
// data-access, so it's unit-testable with fakes instead of a real DB (DI over mocking Drizzle).

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
import type { deleteSubscription, getLeagueById, upsertSubscription } from "@matchday/db";
import {
  listLeaguesForClub,
  type ClubLeagueServiceDeps,
  type ClubLeagues,
} from "@/services/clubLeagueService.ts";
import { resolveClient, type ClientResolverDeps } from "@/services/clientResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SubscriptionServiceDeps = ClientResolverDeps &
  ClubLeagueServiceDeps & {
    getLeagueById: WithoutDb<typeof getLeagueById>;
    upsertSubscription: WithoutDb<typeof upsertSubscription>;
    deleteSubscription: WithoutDb<typeof deleteSubscription>;
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

  // The generated id is only used when this insert wins; re-subscribing conflicts on
  // (client, league) and keeps the original row's id, so return what came back rather than what we
  // minted — otherwise the caller prints an id that was never persisted.
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
    "findClientByName" | "findClubsByName" | "listLeaguesByClubId" | "upsertSubscription"
  >;
  clientName: string;
  clubName: string;
  /** Resolve the club and its leagues without writing any subscriptions — the safe-by-default
   * habit for a fuzzy club match (#85): a typo'd `--club` is a prod-data event otherwise. */
  dryRun: boolean;
};

export type ClubSubscriptionResult = ClubLeagues & {
  /** Empty on a dry run — nothing was written. */
  subscriptionIds: SubscriptionId[];
};

/** Subscribe a client to every league resolved for a club (#85) — onboarding a real club is one
 * call instead of one `add-subscription` per league. Resolves the club/leagues before the client
 * so an ambiguous or typo'd `--club` fails before any subscription write is attempted, dry run
 * or not. */
export async function createSubscriptionsForClub(
  input: CreateSubscriptionsForClubInput,
): Promise<Result<ClubSubscriptionResult>> {
  const { deps, clientName, clubName, dryRun } = input;

  const clubLeaguesResult = await listLeaguesForClub(deps, clubName);
  if (!clubLeaguesResult.ok) {
    return clubLeaguesResult;
  }
  const { club, leagues } = clubLeaguesResult.value;

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  if (dryRun) {
    return ok({ club, leagues, subscriptionIds: [] });
  }

  const subscriptionIds: SubscriptionId[] = [];
  for (const league of leagues) {
    const id = generateId("subscription");
    // Sequential, not Promise.all: each failure should stop the run where it is rather than
    // firing every remaining upsert concurrently against a client that just failed to resolve
    // or a league that turned out invalid.
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

  return ok({ club, leagues, subscriptionIds });
}

/** Hard-delete a subscription, narrowing an unknown id to a `notFound` outcome so the CLI reports
 * a bad id rather than exiting 0 on a no-op. */
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
