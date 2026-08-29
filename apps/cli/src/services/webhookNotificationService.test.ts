import { ok, serverError, signWebhookPayload } from "@matchday/domain";
import { makeFakeLogger } from "#test/fixtures/logger.ts";
import {
  notifyLeagueSubscribers,
  type WebhookNotificationServiceDeps,
  type WebhookTarget,
} from "#services/webhookNotificationService.ts";

const crawledAt = new Date("2026-08-12T09:00:00.000Z");

function makeTarget(overrides: Partial<WebhookTarget> = {}): WebhookTarget {
  return {
    id: "ccl_abc123",
    clientName: "Williamstown SC",
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
  it("returns an empty result for a league with no webhook targets", async () => {
    const deps = makeDeps();

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt,
      targets: [],
    });

    expect(outcomes).toEqual([]);
    expect(deps.sendWebhook).not.toHaveBeenCalled();
  });

  it("sends every target the same payload, signed with its own secret", async () => {
    const sendWebhook = vi.fn().mockResolvedValue(ok(undefined));
    const deps = makeDeps({ sendWebhook });
    const targets = [
      makeTarget({ id: "ccl_one", webhookSecret: "whsec_one" }),
      makeTarget({ id: "ccl_two", webhookSecret: "whsec_two" }),
    ];

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt,
      targets,
    });

    const expectedBody = JSON.stringify({
      leagueId: "lea_abc123",
      hasChanges: true,
      crawledAt: crawledAt.toISOString(),
    });
    expect(sendWebhook).toHaveBeenCalledWith({
      url: targets[0]?.webhookUrl,
      body: expectedBody,
      signature: await signWebhookPayload(expectedBody, "whsec_one"),
    });
    expect(sendWebhook).toHaveBeenCalledWith({
      url: targets[1]?.webhookUrl,
      body: expectedBody,
      signature: await signWebhookPayload(expectedBody, "whsec_two"),
    });
    expect(outcomes).toEqual([
      { clientClubId: "ccl_one", delivered: true },
      { clientClubId: "ccl_two", delivered: true },
    ]);
  });

  it("isolates one target's delivery failure from the rest", async () => {
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
    const targets = [
      makeTarget({ id: "ccl_failing", webhookUrl: "https://example.com/webhooks/failing" }),
      makeTarget({ id: "ccl_ok" }),
    ];

    const outcomes = await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: false,
      crawledAt,
      targets,
    });

    expect(outcomes).toEqual([
      { clientClubId: "ccl_failing", delivered: false },
      { clientClubId: "ccl_ok", delivered: true },
    ]);
  });

  it("logs a delivery failure with the client club and league ids", async () => {
    const sendWebhook = vi.fn().mockResolvedValue(serverError("Webhook POST failed: HTTP 500"));
    const deps = makeDeps({ sendWebhook });

    await notifyLeagueSubscribers(deps, {
      leagueId: "lea_abc123",
      hasChanges: false,
      crawledAt,
      targets: [makeTarget({ id: "ccl_failing" })],
    });

    expect(deps.logger.warn).toHaveBeenCalledWith(
      "webhook.deliveryfailed",
      "Webhook POST failed: HTTP 500",
      expect.objectContaining({ clientClubId: "ccl_failing", leagueId: "lea_abc123" }),
    );
  });
});
