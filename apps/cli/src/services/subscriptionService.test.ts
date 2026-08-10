import { notFound, ok, serverError } from "@matchday/domain";
import {
  createSubscription,
  removeSubscription,
  type SubscriptionServiceDeps,
} from "./subscriptionService.ts";

function makeDeps(overrides: Partial<SubscriptionServiceDeps> = {}): SubscriptionServiceDeps {
  return {
    getLeagueById: vi.fn().mockResolvedValue(ok({ id: "lea_abc123" })),
    upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated" })),
    deleteSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_existing00" })),
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    ...overrides,
  };
}

describe("createSubscription", () => {
  it("returns the persisted subscription id when the league exists", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated0" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(ok("sub_generated0"));
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli_existing000", leagueId: "lea_abc123" }),
    );
  });

  it("returns the existing row's id when re-subscribing, not the freshly minted one", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_original00" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(ok("sub_original00"));
    const mintedId = vi.mocked(deps.upsertSubscription).mock.calls[0]?.[0]?.id;
    expect(mintedId).not.toEqual("sub_original00");
  });

  it("errors when the upserted subscription row id lacks the sub_ prefix", async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "lea_wrong00000" })),
    });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result.ok).toBe(false);
  });

  it("returns an error without upserting when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_missing",
    });

    expect(result).toEqual(notFound("League not found: lea_missing"));
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates a league lookup failure", async () => {
    const lookupError = serverError("Failed to get league by id");
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(lookupError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(lookupError);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates a client resolution failure without upserting", async () => {
    const clientError = serverError("Failed to find client by name");
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(clientError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(clientError);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates an upsert failure", async () => {
    const upsertError = serverError("Failed to upsert subscription");
    const deps = makeDeps({ upsertSubscription: vi.fn().mockResolvedValue(upsertError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(upsertError);
  });

  it("errors without subscribing when the client name is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscription({
      deps,
      clientName: "Typo FC",
      leagueId: "lea_abc123",
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });
});

describe("removeSubscription", () => {
  it("succeeds when the subscription exists", async () => {
    const deps = makeDeps();

    const result = await removeSubscription(deps, "sub_existing00");

    expect(result).toEqual(ok(undefined));
    expect(deps.deleteSubscription).toHaveBeenCalledWith("sub_existing00");
  });

  it("errors when the subscription id doesn't exist", async () => {
    const deps = makeDeps({ deleteSubscription: vi.fn().mockResolvedValue(ok(null)) });

    const result = await removeSubscription(deps, "sub_missing000");

    expect(result).toEqual(notFound("Subscription not found: sub_missing000"));
  });

  it("propagates a delete failure", async () => {
    const deleteError = serverError("Failed to delete subscription");
    const deps = makeDeps({ deleteSubscription: vi.fn().mockResolvedValue(deleteError) });

    const result = await removeSubscription(deps, "sub_existing00");

    expect(result).toEqual(deleteError);
  });
});
