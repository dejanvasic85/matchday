// Webhook notification service (#105): notifies webhook-configured subscriptions after a crawl.
// Each delivery is independent — a failing endpoint is logged and skipped, never fails the batch.

import { signWebhookPayload, type Logger, type Result } from "@matchday/domain";

export type WebhookSubscription = {
  id: string;
  webhookUrl: string;
  webhookSecret: string;
};

export type WebhookPayload = {
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
  subscriptionId: string;
  delivered: boolean;
};

export type NotifyLeagueSubscribersInput = {
  leagueId: string;
  hasChanges: boolean;
  crawledAt: Date;
  subscriptions: WebhookSubscription[];
};

/** Fans a league's post-crawl result out to every webhook-configured subscription on it.
 * Deliveries run concurrently — they're independent and `sendWebhook` never throws, so nothing
 * here can fail the batch; each subscriber gets its own `NotificationOutcome`. */
export async function notifyLeagueSubscribers(
  deps: WebhookNotificationServiceDeps,
  input: NotifyLeagueSubscribersInput,
): Promise<NotificationOutcome[]> {
  const { leagueId, hasChanges, crawledAt, subscriptions } = input;
  const payload: WebhookPayload = { leagueId, hasChanges, crawledAt: crawledAt.toISOString() };
  const body = JSON.stringify(payload);

  return Promise.all(
    subscriptions.map(async (subscription): Promise<NotificationOutcome> => {
      const signature = await signWebhookPayload(body, subscription.webhookSecret);
      const result = await deps.sendWebhook({ url: subscription.webhookUrl, body, signature });
      if (!result.ok) {
        deps.logger.warn("webhook.deliveryfailed", result.error.message, {
          subscriptionId: subscription.id,
          leagueId,
          cause: result.error.cause,
        });
        return { subscriptionId: subscription.id, delivered: false };
      }
      return { subscriptionId: subscription.id, delivered: true };
    }),
  );
}
