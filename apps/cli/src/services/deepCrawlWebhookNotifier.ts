// Wraps a deep crawl with post-crawl webhook notification (#105): snapshots a league's fixtures +
// table before the crawl, runs it, snapshots again, diffs, and notifies that league's
// webhook-configured subscriptions. A higher-order wrapper around the crawl call (rather than a
// job constructing this inline) so the branching — skip on dry run, skip when nobody's listening,
// skip notifying on a failed crawl or a snapshot we couldn't take — is unit-testable without a
// live crawl session, per AGENTS.md's "orchestration belongs in services".

import { type Logger, type Result } from "@matchday/domain";
import type {
  listActiveSubscriptionsForLeagueWithWebhook,
  listFixturesByLeagueId,
  listTableEntriesByLeagueId,
} from "@matchday/db";
import { detectLeagueChanges, type LeagueSnapshot } from "#services/leagueChangeDetector.ts";
import { notifyLeagueSubscribers, type SendWebhook } from "#services/webhookNotificationService.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type LeagueWebhookNotifierDeps = {
  listActiveSubscriptionsForLeagueWithWebhook: WithoutDb<
    typeof listActiveSubscriptionsForLeagueWithWebhook
  >;
  listFixturesByLeagueId: WithoutDb<typeof listFixturesByLeagueId>;
  listTableEntriesByLeagueId: WithoutDb<typeof listTableEntriesByLeagueId>;
  sendWebhook: SendWebhook;
  logger: Logger;
  /** Injected so tests get a deterministic `crawledAt` (AGENTS.md: clock as a collaborator). */
  now: () => Date;
};

export type WithLeagueChangeNotificationInput = {
  leagueId: string;
  dryRun: boolean;
};

async function snapshotLeague(
  deps: Pick<
    LeagueWebhookNotifierDeps,
    "listFixturesByLeagueId" | "listTableEntriesByLeagueId" | "logger"
  >,
  leagueId: string,
): Promise<LeagueSnapshot | null> {
  const [fixturesResult, tableEntriesResult] = await Promise.all([
    deps.listFixturesByLeagueId(leagueId),
    deps.listTableEntriesByLeagueId(leagueId),
  ]);
  if (!fixturesResult.ok) {
    deps.logger.warn("webhook.snapshotfailed", fixturesResult.error.message, {
      leagueId,
      cause: fixturesResult.error.cause,
    });
    return null;
  }
  if (!tableEntriesResult.ok) {
    deps.logger.warn("webhook.snapshotfailed", tableEntriesResult.error.message, {
      leagueId,
      cause: tableEntriesResult.error.cause,
    });
    return null;
  }
  return { fixtures: fixturesResult.value, tableEntries: tableEntriesResult.value };
}

/**
 * Runs `runCrawl`, notifying the league's webhook-configured subscriptions afterwards if the
 * crawl succeeded and a before/after snapshot could both be taken. Notification is best-effort
 * and never changes the returned `Result` — it's exactly `runCrawl`'s own outcome, passed through.
 */
export async function withLeagueChangeNotification<T>(
  deps: LeagueWebhookNotifierDeps,
  input: WithLeagueChangeNotificationInput,
  runCrawl: () => Promise<Result<T>>,
): Promise<Result<T>> {
  const { leagueId, dryRun } = input;

  // Nothing is persisted on a dry run, so there's nothing to diff or tell anyone about.
  if (dryRun) {
    return runCrawl();
  }

  const subscriptionsResult = await deps.listActiveSubscriptionsForLeagueWithWebhook(leagueId);
  if (!subscriptionsResult.ok) {
    deps.logger.warn("webhook.subscriptionlookupfailed", subscriptionsResult.error.message, {
      leagueId,
      cause: subscriptionsResult.error.cause,
    });
    return runCrawl();
  }
  const subscriptions = subscriptionsResult.value;
  // The common case today: no client has configured a webhook for this league. Skip the extra
  // snapshot reads entirely rather than doing work nobody will see the result of.
  if (subscriptions.length === 0) {
    return runCrawl();
  }

  const before = await snapshotLeague(deps, leagueId);
  const result = await runCrawl();
  if (!result.ok || before === null) {
    return result;
  }

  const after = await snapshotLeague(deps, leagueId);
  if (after === null) {
    return result;
  }

  const { hasChanges, fixturesChanged, tableChanged } = detectLeagueChanges(before, after);
  const outcomes = await notifyLeagueSubscribers(
    { sendWebhook: deps.sendWebhook, logger: deps.logger },
    { leagueId, hasChanges, crawledAt: deps.now(), subscriptions },
  );
  deps.logger.info("webhook.notified", "notified league's webhook subscriptions", {
    leagueId,
    hasChanges,
    fixturesChanged,
    tableChanged,
    delivered: outcomes.filter((outcome) => outcome.delivered).length,
    total: outcomes.length,
  });

  return result;
}
