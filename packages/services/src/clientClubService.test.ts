import { badRequest, notFound, ok, serverError } from "@matchday/domain";
import {
  followClubById,
  setClubWebhookById,
  unfollowClubById,
  type ClientClubServiceDeps,
} from "#clientClubService.ts";
import { makeId } from "#test/fixtures/id.ts";

const clientId = makeId("cli_stadly0000", "client");
const clubId = makeId("clb_williams000", "club");
const webhookUrl = "https://www.williamstownsc.com/api/revalidate";

function makeDeps(overrides: Partial<ClientClubServiceDeps> = {}): ClientClubServiceDeps {
  return {
    getClubById: vi.fn().mockResolvedValue(ok({ id: clubId, name: "Williamstown SC" })),
    upsertClientClubWithWebhook: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    setClientClubWebhook: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    deleteClientClub: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    ...overrides,
  };
}

describe("followClubById", () => {
  it("writes the follow and webhook together and returns the new secret", async () => {
    const deps = makeDeps();

    const result = await followClubById(deps, { clientId, clubId, webhookUrl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        clubId,
        webhookUrl,
        webhookSecret: expect.any(String),
      });
      expect(deps.upsertClientClubWithWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId,
          clubId,
          webhookUrl,
          webhookSecret: result.value.webhookSecret,
        }),
      );
    }
  });

  it("mints a different secret on a second follow", async () => {
    const deps = makeDeps();

    const first = await followClubById(deps, { clientId, clubId, webhookUrl });
    const second = await followClubById(deps, { clientId, clubId, webhookUrl });

    expect(first.ok && second.ok && first.value.webhookSecret !== second.value.webhookSecret).toBe(
      true,
    );
  });

  it("refuses a URL that is not a public https host, without reading or writing", async () => {
    const deps = makeDeps();

    const result = await followClubById(deps, {
      clientId,
      clubId,
      webhookUrl: "http://localhost/hook",
    });

    expect(result).toEqual(
      badRequest("Webhook URL must be https with a public hostname: http://localhost/hook"),
    );
    expect(deps.getClubById).not.toHaveBeenCalled();
    expect(deps.upsertClientClubWithWebhook).not.toHaveBeenCalled();
  });

  it("reports an unknown club as not found, without writing", async () => {
    const deps = makeDeps({ getClubById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await followClubById(deps, { clientId, clubId, webhookUrl });

    expect(result).toEqual(notFound("Club not found"));
    expect(deps.upsertClientClubWithWebhook).not.toHaveBeenCalled();
  });

  it("passes a write failure through", async () => {
    const failure = serverError("Failed to upsert client club");
    const deps = makeDeps({ upsertClientClubWithWebhook: vi.fn().mockResolvedValue(failure) });

    const result = await followClubById(deps, { clientId, clubId, webhookUrl });

    expect(result).toEqual(failure);
  });
});

describe("setClubWebhookById", () => {
  it("sets the webhook on an existing follow with a fresh secret", async () => {
    const deps = makeDeps();

    const result = await setClubWebhookById(deps, { clientId, clubId, webhookUrl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(deps.setClientClubWebhook).toHaveBeenCalledWith(
        clientId,
        clubId,
        webhookUrl,
        result.value.webhookSecret,
      );
    }
  });

  it("reports a missing follow as not found", async () => {
    const deps = makeDeps({ setClientClubWebhook: vi.fn().mockResolvedValue(ok(null)) });

    const result = await setClubWebhookById(deps, { clientId, clubId, webhookUrl });

    expect(result).toEqual(notFound("The client doesn't follow this club"));
  });

  it("refuses a bad URL without writing", async () => {
    const deps = makeDeps();

    const result = await setClubWebhookById(deps, {
      clientId,
      clubId,
      webhookUrl: "https://10.0.0.1/hook",
    });

    expect(result.ok).toBe(false);
    expect(deps.setClientClubWebhook).not.toHaveBeenCalled();
  });
});

describe("unfollowClubById", () => {
  it("removes the follow", async () => {
    const deps = makeDeps();

    const result = await unfollowClubById(deps, { clientId, clubId });

    expect(result).toEqual(ok({ clientId, clubId }));
    expect(deps.deleteClientClub).toHaveBeenCalledWith(clientId, clubId);
  });

  it("reports a missing follow as not found", async () => {
    const deps = makeDeps({ deleteClientClub: vi.fn().mockResolvedValue(ok(null)) });

    const result = await unfollowClubById(deps, { clientId, clubId });

    expect(result).toEqual(notFound("The client doesn't follow this club"));
  });
});
