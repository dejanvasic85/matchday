// Subscription data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { runQuery, runUpsert } from "./runQuery.ts";
import { league, subscription } from "./schema.ts";

type Subscription = typeof subscription.$inferSelect;
type SubscriptionInsert = typeof subscription.$inferInsert;

/** A subscription joined to the league it targets — what `mday client list` renders, so the
 * operator sees "Div 1 North" rather than a bare `lea_` id. */
export type SubscriptionWithLeague = {
  id: string;
  clientId: string;
  leagueId: string;
  leagueName: string;
};

/**
 * Upsert a subscription by its `(client_id, league_id)` key: a client subscribes to a given
 * league at most once, so re-adding the same pair is idempotent rather than a duplicate.
 */
export async function upsertSubscription(
  db: Db,
  values: SubscriptionInsert,
): Promise<Result<Subscription>> {
  return runUpsert(
    () =>
      db
        .insert(subscription)
        .values(values)
        .onConflictDoUpdate({
          target: [subscription.clientId, subscription.leagueId],
          set: { updatedAt: new Date() },
        })
        .returning(),
    "subscription",
    values,
  );
}

/**
 * The distinct set of league ids that have ≥1 subscription — the deep crawl's scope. A league with
 * many subscribers is crawled once, so the result is deduplicated in SQL.
 */
export async function listSubscribedLeagueIds(db: Db): Promise<Result<string[]>> {
  const result = await runQuery(
    () => db.selectDistinct({ leagueId: subscription.leagueId }).from(subscription),
    "Failed to list subscribed league ids",
  );
  return result.ok ? ok(result.value.map((row) => row.leagueId)) : result;
}

/** Every subscription with its league's name, league-ordered. Not client-scoped: `client list`
 * renders the whole roster in one pass, so it groups these by `clientId` itself rather than
 * issuing a query per client. */
export async function listSubscriptionsWithLeague(
  db: Db,
): Promise<Result<SubscriptionWithLeague[]>> {
  return runQuery(
    () =>
      db
        .select({
          id: subscription.id,
          clientId: subscription.clientId,
          leagueId: subscription.leagueId,
          leagueName: league.name,
        })
        .from(subscription)
        .innerJoin(league, eq(subscription.leagueId, league.id))
        .orderBy(asc(league.name)),
    "Failed to list subscriptions with league",
  );
}

/** Hard-delete a subscription by id, returning the deleted row (or `null` when no such id existed,
 * so the caller can report "not found" rather than a silent no-op). Dropping the row takes its
 * league out of the deep crawl's scope as soon as no other client subscribes to it. */
export async function deleteSubscription(db: Db, id: string): Promise<Result<Subscription | null>> {
  const result = await runQuery(
    () => db.delete(subscription).where(eq(subscription.id, id)).returning(),
    "Failed to delete subscription",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
