// Real webhook delivery (#105): a single POST with a short timeout, no retries — the v1 scope
// decided in docs/plans/2026-08-12-subscription-webhooks.md. Failure is reported as a `Result`,
// never thrown, so `webhookNotificationService` can isolate one subscriber's failure from the
// rest without a try/catch of its own.

import { ok, serverError, type Result } from "@matchday/domain";
import type { SendWebhook } from "#services/webhookNotificationService.ts";

const webhookTimeoutMs = 5000;

export const sendWebhook: SendWebhook = async ({ url, body, signature }): Promise<Result<void>> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-matchday-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(webhookTimeoutMs),
    });
    if (!response.ok) {
      return serverError(`Webhook POST to ${url} failed: HTTP ${response.status}`);
    }
    return ok(undefined);
  } catch (cause) {
    return serverError(`Webhook POST to ${url} failed`, cause);
  }
};
