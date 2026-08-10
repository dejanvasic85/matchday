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
import { resolveClient, type ClientResolverDeps } from "./clientResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SubscriptionServiceDeps = ClientResolverDeps & {
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
