// Webhook notification service: notifies webhook-configured subscriptions after a crawl.
// Each delivery is independent — a failing endpoint is logged and skipped, never fails the batch.

import { signWebhookPayload, type Logger, type Result } from "@matchday/domain";

/** One delivery target: a client's followed club with a webhook configured. Identified by the
 * `client_club` row, since that's what owns the webhook now — it outlives any one season's
 * subscriptions. */
export type WebhookTarget = {
  id: string;
  clientName: string;
  webhookUrl: string;
  webhookSecret: string;
};

type WebhookPayload = {
  leagueId: string;
  hasChanges: boolean;
  crawledAt: string;
};

/** Delivers one signed webhook POST. The real implementation (`#webhookSender.ts`) is a single
 * fetch attempt with a short timeout and no retries; tests inject a fake. Never throws — failure
 * is a `Result`, so this service can isolate one subscriber's failure without its own try/catch. */
export type SendWebhook = (input: {
  url: string;
  body: string;
  signature: string;
}) => Promise<Result<void>>;

export type WebhookNotificationServiceDeps = {
  sendWebhook: SendWebhook;
  logger: Logger;
};

export type NotificationOutcome = {
  clientClubId: string;
  delivered: boolean;
};

export type NotifyLeagueSubscribersInput = {
  leagueId: string;
  hasChanges: boolean;
  crawledAt: Date;
  targets: WebhookTarget[];
};

/**
 * Fans a league's post-crawl result out to every webhook target watching it. Deliveries run
 * concurrently — they're independent and `sendWebhook` never throws, so nothing here can fail the
 * batch; each target gets its own `NotificationOutcome`.
 *
 * The league is named in the signed JSON body only. It is deliberately *not* also appended to the
 * URL as a query parameter: an unsigned copy of the same value invites a receiver to trust the
 * forgeable one.
 */
export async function notifyLeagueSubscribers(
  deps: WebhookNotificationServiceDeps,
  input: NotifyLeagueSubscribersInput,
): Promise<NotificationOutcome[]> {
  const { leagueId, hasChanges, crawledAt, targets } = input;
  const payload: WebhookPayload = { leagueId, hasChanges, crawledAt: crawledAt.toISOString() };
  const body = JSON.stringify(payload);

  return Promise.all(
    targets.map(async (target): Promise<NotificationOutcome> => {
      const signature = await signWebhookPayload(body, target.webhookSecret);
      const result = await deps.sendWebhook({ url: target.webhookUrl, body, signature });
      if (!result.ok) {
        deps.logger.warn("webhook.deliveryfailed", result.error.message, {
          clientClubId: target.id,
          clientName: target.clientName,
          leagueId,
          cause: result.error.cause,
        });
        return { clientClubId: target.id, delivered: false };
      }
      return { clientClubId: target.id, delivered: true };
    }),
  );
}
