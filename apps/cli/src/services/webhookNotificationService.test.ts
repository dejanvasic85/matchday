import { ok, serverError, signWebhookPayload } from "@matchday/domain";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import {
  notifyLeagueSubscribers,
  type WebhookNotificationServiceDeps,
  type WebhookSubscription,
} from "#services/webhookNotificationService.ts";

const crawledAt = new Date("2026-08-12T09:00:00.000Z");

function makeSubscription(overrides: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    id: "sub_abc123",
    webhookUrl: "https://example.com/webhooks/matchday",
    webhookSecret: "whsec_test",
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<WebhookNotificationServiceDeps> = {},
): WebhookNotificationServiceDeps {
  return {
    sendWebhook: vi.fn().mockResolvedValue(ok(undefined)),
    logger: makeFakeLogger(),
    ...overrides,
  };
}

describe("notifyLeagueSubscribers", () => {
  it("returns an empty result for a league with no webhook-configured subscriptions", async () => {
    const deps = makeDeps();

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt,
      subscriptions: [],
    });

    expect(outcomes).toEqual([]);
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("sends every subscriber the same payload, signed with its own secret", async () => {
    const sendWebhook = vi.fn().mockResolvedValue(ok(undefined));
    const deps = makeDeps({ sendWebhook });
    const subscriptions = [
      makeSubscription({ id: "sub_one", webhookSecret: "whsec_one" }),
      makeSubscription({ id: "sub_two", webhookSecret: "whsec_two" }),
    ];

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt,
      subscriptions,
    });

    const expectedBody = JSON.stringify({
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt: crawledAt.toISOString(),
    });
    expect(sendWebhook).toHaveBeenCalledWith({
      url: subscriptions[0]?.webhookUrl,
      body: expectedBody,
      signature: await signWebhookPayload(expectedBody, "whsec_one"),
    });
    expect(sendWebhook).toHaveBeenCalledWith({
      url: subscriptions[1]?.webhookUrl,
      body: expectedBody,
      signature: await signWebhookPayload(expectedBody, "whsec_two"),
    });
    expect(outcomes).toEqual([
      { subscriptionId: "sub_one", delivered: true },
      { subscriptionId: "sub_two", delivered: true },
    ]);
  });

  it("isolates one subscriber's delivery failure from the rest", async () => {
    // Deliveries can reach sendWebhook in either order, so dispatch by URL requested, not call
    // order (mockResolvedValueOnce assumed call order, which was flaky in CI).
    const sendWebhook = vi
      .fn()
      .mockImplementation(({ url }: { url: string }) =>
        Promise.resolve(
          url === "https://example.com/webhooks/failing"
            ? serverError("Webhook POST failed: HTTP 500")
            : ok(undefined),
        ),
      );
    const deps = makeDeps({ sendWebhook });
    const subscriptions = [
      makeSubscription({ id: "sub_failing", webhookUrl: "https://example.com/webhooks/failing" }),
      makeSubscription({ id: "sub_ok" }),
    ];

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: false,
      crawledAt,
      subscriptions,
    });

    expect(outcomes).toEqual([
      { subscriptionId: "sub_failing", delivered: false },
      { subscriptionId: "sub_ok", delivered: true },
    ]);
  });

  it("logs a delivery failure with the subscription and league ids", async () => {
    const sendWebhook = vi.fn().mockResolvedValue(serverError("Webhook POST failed: HTTP 500"));
    const deps = makeDeps({ sendWebhook });

    await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: false,
      crawledAt,
      subscriptions: [makeSubscription({ id: "sub_failing" })],
    });

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "webhook.deliveryfailed",
      "Webhook POST failed: HTTP 500",
      expect.objectContaining({ subscriptionId: "sub_failing", leagueId: "lea_abc123" }),
    );
  });
});
