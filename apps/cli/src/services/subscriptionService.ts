// Subscription creation (0012): a client subscribes to one of our leagues. Business logic lives
// here (AGENTS.md) — validates the league exists, mints the id, and delegates the write to
// data-access, so it's unit-testable with fakes instead of a real DB (DI over mocking Drizzle).

import {
  err,
  generateId,
  ok,
  type LeagueId,
  type Result,
  type SubscriptionId,
} from "@matchday/domain";
import type { getLeagueById, upsertSubscription } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SubscriptionServiceDeps = {
  getLeagueById: WithoutDb<typeof getLeagueById>;
  upsertSubscription: WithoutDb<typeof upsertSubscription>;
};

export type CreateSubscriptionInput = {
  deps: SubscriptionServiceDeps;
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
    return err({ message: `League not found: ${leagueId}` });
  }

  const id = generateId("subscription");
  const upserted = await deps.upsertSubscription({ id, clientName, leagueId });
  if (!upserted.ok) {
    return upserted;
  }

  return ok(id);
}
