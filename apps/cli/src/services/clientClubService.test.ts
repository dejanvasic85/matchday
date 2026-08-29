import { badRequest, notFound, ok, serverError } from "@matchday/domain";
import {
  clearClientClubWebhook,
  followClub,
  setClientClubWebhook,
  unfollowClub,
  type ClientClubServiceDeps,
} from "#services/clientClubService.ts";

function makeDeps(overrides: Partial<ClientClubServiceDeps> = {}): ClientClubServiceDeps {
  return {
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    findClubsByName: vi
      .fn()
      .mockResolvedValue(ok([{ id: "clb_existing000", name: "Williamstown SC" }])),
    upsertClientClub: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    deleteClientClub: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    setClientClubWebhook: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    clearClientClubWebhook: vi.fn().mockResolvedValue(ok({ id: "ccl_existing00" })),
    ...overrides,
  };
}

describe("followClub", () => {
  it("records the follow for the resolved client and club", async () => {
    const deps = makeDeps();

    const result = await followClub(deps, "Williamstown SC", "Williamstown");

    expect(result).toEqual(
      ok({
        client: "Williamstown SC",
        club: { id: "clb_existing000", name: "Williamstown SC" },
      }),
    );
    expect(deps.upsertClientClub).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli_existing000", clubId: "clb_existing000" }),
    );
  });

  it("fails on an ambiguous club without resolving the client or writing", async () => {
    const deps = makeDeps({
      findClubsByName: vi.fn().mockResolvedValue(
        ok([
          { id: "clb_williams0001", name: "Williamstown SC" },
          { id: "clb_williams0002", name: "Williamstown Juniors" },
        ]),
      ),
    });

    const result = await followClub(deps, "Williamstown SC", "Williams");

    expect(result).toEqual(
      badRequest(
        '"Williams" matches more than one club — candidates: Williamstown SC (clb_williams0001), ' +
          "Williamstown Juniors (clb_williams0002)",
      ),
    );
    expect(deps.findClientByName).not.toHaveBeenCalled();
    expect(deps.upsertClientClub).not.toHaveBeenCalled();
  });

  it("errors without writing when the client is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await followClub(deps, "Typo FC", "Williamstown");

    expect(result.ok).toBe(false);
    expect(deps.upsertClientClub).not.toHaveBeenCalled();
  });
});

describe("unfollowClub", () => {
  it("removes the follow", async () => {
    const deps = makeDeps();

    const result = await unfollowClub(deps, "Williamstown SC", "Williamstown");

    expect(result.ok).toBe(true);
    expect(deps.deleteClientClub).toHaveBeenCalledWith("cli_existing000", "clb_existing000");
  });

  it("reports a client that doesn't follow the club as not found", async () => {
    const deps = makeDeps({ deleteClientClub: vi.fn().mockResolvedValue(ok(null)) });

    const result = await unfollowClub(deps, "Williamstown SC", "Williamstown");

    expect(result).toEqual(notFound('"Williamstown SC" doesn\'t follow "Williamstown SC"'));
  });
});

describe("setClientClubWebhook", () => {
  it("persists the URL with a freshly minted secret and returns both", async () => {
    const deps = makeDeps();

    const result = await setClientClubWebhook(
      deps,
      "Williamstown SC",
      "Williamstown",
      "https://example.com/revalidate",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.webhookUrl).toBe("https://example.com/revalidate");
      expect(result.value.webhookSecret).not.toBe("");
      expect(deps.setClientClubWebhook).toHaveBeenCalledWith(
        "cli_existing000",
        "clb_existing000",
        "https://example.com/revalidate",
        result.value.webhookSecret,
      );
    }
  });

  it("rejects a non-http(s) URL without touching the database", async () => {
    const deps = makeDeps();

    const result = await setClientClubWebhook(
      deps,
      "Williamstown SC",
      "Williamstown",
      "ftp://example.com/hook",
    );

    expect(result).toEqual(
      badRequest("Webhook URL must be a valid http(s) URL: ftp://example.com/hook"),
    );
    expect(deps.setClientClubWebhook).not.toHaveBeenCalled();
  });

  it("tells the operator to follow the club first when there's no follow to configure", async () => {
    const deps = makeDeps({ setClientClubWebhook: vi.fn().mockResolvedValue(ok(null)) });

    const result = await setClientClubWebhook(
      deps,
      "Williamstown SC",
      "Williamstown",
      "https://example.com/revalidate",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("follow-club");
    }
  });

  it("propagates a write failure", async () => {
    const setError = serverError("Failed to set client club webhook");
    const deps = makeDeps({ setClientClubWebhook: vi.fn().mockResolvedValue(setError) });

    const result = await setClientClubWebhook(
      deps,
      "Williamstown SC",
      "Williamstown",
      "https://example.com/revalidate",
    );

    expect(result).toEqual(setError);
  });
});

describe("clearClientClubWebhook", () => {
  it("clears the webhook for the resolved follow", async () => {
    const deps = makeDeps();

    const result = await clearClientClubWebhook(deps, "Williamstown SC", "Williamstown");

    expect(result).toEqual(ok({ id: "clb_existing000", name: "Williamstown SC" }));
    expect(deps.clearClientClubWebhook).toHaveBeenCalledWith("cli_existing000", "clb_existing000");
  });

  it("reports a client that doesn't follow the club as not found", async () => {
    const deps = makeDeps({ clearClientClubWebhook: vi.fn().mockResolvedValue(ok(null)) });

    const result = await clearClientClubWebhook(deps, "Williamstown SC", "Williamstown");

    expect(result.ok).toBe(false);
  });
});
