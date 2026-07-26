// Subscription data access: build a query, execute it, return a `Result` of rows. No business
// rules here (ADR / AGENTS.md). Driver errors are captured into `err` rather than thrown.

import { ok, type Result } from "@matchday/domain";
import type { Db } from "./client.ts";
import { runQuery, runUpsert } from "./runQuery.ts";
import { subscription } from "./schema.ts";

type Subscription = typeof subscription.$inferSelect;
type SubscriptionInsert = typeof subscription.$inferInsert;

/**
 * Upsert a subscription by its `(client_name, league_id)` key: a client subscribes to a given
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
          target: [subscription.clientName, subscription.leagueId],
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
