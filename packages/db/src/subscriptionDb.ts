// Subscription data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "#client.ts";
import { runQuery, runUpsert } from "#runQuery.ts";
import { league, subscription } from "#schema.ts";

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
 * league at most once, so re-adding the same pair is idempotent rather than a duplicate. Also
 * revives a soft-deleted row (clears `deletedAt`) instead of leaving it removed — the unique index
 * is on `(client_id, league_id)` regardless of `deleted_at`, so re-subscribing after `client
 * remove-subscription` hits this conflict branch, not a fresh insert.
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
          set: { deletedAt: null, updatedAt: new Date() },
        })
        .returning(),
    "subscription",
    values,
  );
}

/**
 * The distinct set of league ids with ≥1 *active* subscription — the deep crawl's scope. A league
 * with many subscribers is crawled once, so the result is deduplicated in SQL. Soft-deleted
 * subscriptions are excluded: a removed subscription must take its league out of scope as soon as
 * no other client actively subscribes to it.
 */
export async function listSubscribedLeagueIds(db: Db): Promise<Result<string[]>> {
  const result = await runQuery(
    () =>
      db
        .selectDistinct({ leagueId: subscription.leagueId })
        .from(subscription)
        .where(isNull(subscription.deletedAt)),
    "Failed to list subscribed league ids",
  );
  return result.ok ? ok(result.value.map((row) => row.leagueId)) : result;
}

/** Every *active* subscription with its league's name, league-ordered. Not client-scoped: `client
 * list` renders the whole roster in one pass, so it groups these by `clientId` itself rather than
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
        .where(isNull(subscription.deletedAt))
        .orderBy(asc(league.name)),
    "Failed to list subscriptions with league",
  );
}

/** Whether `clientId` has an *active* subscription to `leagueId` — the gate fixtures/table reads
 * are checked against (0045, ADR 0012): a client only sees the deep-crawl data for leagues it
 * actually subscribes to. */
export async function hasActiveSubscription(
  db: Db,
  clientId: string,
  leagueId: string,
): Promise<Result<boolean>> {
  const result = await runQuery(
    () =>
      db
        .select({ id: subscription.id })
        .from(subscription)
        .where(
          and(
            eq(subscription.clientId, clientId),
            eq(subscription.leagueId, leagueId),
            isNull(subscription.deletedAt),
          ),
        )
        .limit(1),
    "Failed to check subscription",
  );
  return result.ok ? ok(result.value.length > 0) : result;
}

/** Soft-delete a subscription by id (sets `deletedAt`), returning the updated row — or `null` when
 * no such *active* subscription id existed, so the caller can report "not found" rather than a
 * silent no-op (this also covers re-removing an already-removed subscription). Removing the row
 * from the deep crawl's active scope takes its league out as soon as no other client subscribes. */
export async function deleteSubscription(db: Db, id: string): Promise<Result<Subscription | null>> {
  const result = await runQuery(
    () =>
      db
        .update(subscription)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(subscription.id, id), isNull(subscription.deletedAt)))
        .returning(),
    "Failed to delete subscription",
  );
  return result.ok ? ok(result.value[0] ?? null) : result;
}
