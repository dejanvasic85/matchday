// Real webhook delivery: single POST, short timeout, no retries (v1 scope). Failure is
// reported as a `Result`, never thrown, so callers can isolate one subscriber's failure.

import { ok, serverError, type Result } from "@matchday/domain";
import { validateWebhookUrl } from "@matchday/services";
import type { SendWebhook } from "#services/webhookNotificationService.ts";

const webhookTimeoutMs = 5000;

export const sendWebhook: SendWebhook = async ({ url, body, signature }): Promise<Result<void>> => {
  // Re-checked here, not just on save, so a URL stored before the rule existed can't be sent to.
  const allowed = validateWebhookUrl(url);
  if (!allowed.ok) {
    return serverError(`Webhook delivery refused: ${allowed.error.message}`);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-matchday-signature": `sha256=${signature}`,
      },
      body,
      // A redirect could bounce the request to an internal host, so a 3xx is a failed delivery.
      redirect: "manual",
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
