// Wraps a league crawl with post-crawl webhook notification: snapshots fixtures+table before
// and after, diffs, and notifies. Kept as a wrapper so the skip branches are unit-testable.

import { ok, type Logger, type Result } from "@matchday/domain";
import type {
  listClientClubWebhooksForClubIds,
  listClubIdsByLeagueId,
  listFixturesByLeagueId,
  listSubscriptionsWithLeague,
  listTableEntriesByLeagueId,
} from "@matchday/db";
import { detectLeagueChanges, type LeagueSnapshot } from "#services/leagueChangeDetector.ts";
import {
  notifyLeagueSubscribers,
  type SendWebhook,
  type WebhookTarget,
} from "#services/webhookNotificationService.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type LeagueWebhookNotifierDeps = {
  listClubIdsByLeagueId: WithoutDb<typeof listClubIdsByLeagueId>;
  listClientClubWebhooksForClubIds: WithoutDb<typeof listClientClubWebhooksForClubIds>;
  listSubscriptionsWithLeague: WithoutDb<typeof listSubscriptionsWithLeague>;
  listFixturesByLeagueId: WithoutDb<typeof listFixturesByLeagueId>;
  listTableEntriesByLeagueId: WithoutDb<typeof listTableEntriesByLeagueId>;
  sendWebhook: SendWebhook;
  logger: Logger;
  /** Injected so tests get a deterministic `crawledAt` (AGENTS.md: clock as a collaborator). */
  now: () => Date;
};

/**
 * Who should hear that this league changed: a client that (a) follows a club fielding a team in
 * the league, (b) has a webhook configured on that follow, and (c) actually subscribes to the
 * league. The subscription check keeps the follow from leaking data the client hasn't asked us to
 * crawl — a club plays in leagues a client may have unsubscribed from by hand.
 *
 * A client following two clubs that meet in the same league would otherwise be told twice, so
 * targets are deduplicated by `client_club` row.
 */
async function resolveWebhookTargets(
  deps: Pick<
    LeagueWebhookNotifierDeps,
    "listClubIdsByLeagueId" | "listClientClubWebhooksForClubIds" | "listSubscriptionsWithLeague"
  >,
  leagueId: string,
): Promise<Result<WebhookTarget[]>> {
  const clubIdsResult = await deps.listClubIdsByLeagueId(leagueId);
  if (!clubIdsResult.ok) {
    return clubIdsResult;
  }

  const webhooksResult = await deps.listClientClubWebhooksForClubIds(clubIdsResult.value);
  if (!webhooksResult.ok) {
    return webhooksResult;
  }
  if (webhooksResult.value.length === 0) {
    return ok([]);
  }

  const subscriptionsResult = await deps.listSubscriptionsWithLeague({ leagueId });
  if (!subscriptionsResult.ok) {
    return subscriptionsResult;
  }
  const subscribedClientIds = new Set(subscriptionsResult.value.map((row) => row.clientId));

  const byId = new Map<string, WebhookTarget>();
  for (const webhook of webhooksResult.value) {
    if (!subscribedClientIds.has(webhook.clientId)) {
      continue;
    }
    byId.set(webhook.id, {
      id: webhook.id,
      clientName: webhook.clientName,
      webhookUrl: webhook.webhookUrl,
      webhookSecret: webhook.webhookSecret,
    });
  }
  return ok([...byId.values()]);
}

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

  const targetsResult = await resolveWebhookTargets(deps, leagueId);
  if (!targetsResult.ok) {
    deps.logger.warn("webhook.targetlookupfailed", targetsResult.error.message, {
      leagueId,
      cause: targetsResult.error.cause,
    });
    return runCrawl();
  }
  const targets = targetsResult.value;
  // The common case today: no client has configured a webhook for this league. Skip the extra
  // snapshot reads entirely rather than doing work nobody will see the result of.
  if (targets.length === 0) {
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
    { leagueId, hasChanges, crawledAt: deps.now(), targets },
  );
  deps.logger.info("webhook.notified", "notified league's webhook targets", {
    leagueId,
    hasChanges,
    fixturesChanged,
    tableChanged,
    delivered: outcomes.filter((outcome) => outcome.delivered).length,
    total: outcomes.length,
  });

  return result;
}
