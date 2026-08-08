import { err, ok } from "@matchday/domain";
import { createSubscription, type SubscriptionServiceDeps } from "./subscriptionService.ts";

function makeDeps(overrides: Partial<SubscriptionServiceDeps> = {}): SubscriptionServiceDeps {
  return {
    getLeagueById: vi.fn().mockResolvedValue(ok({ id: "lea_abc123" })),
    upsertSubscription: vi.fn().mockResolvedValue(ok({ id: "sub_generated" })),
    ...overrides,
  };
}

describe("createSubscription", () => {
  it("returns the generated subscription id when the league exists", async () => {
    const deps = makeDeps();

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result.ok).toBe(true);
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ clientName: "Williamstown SC", leagueId: "lea_abc123" }),
    );
  });

  it("returns an error without upserting when the league doesn't exist", async () => {
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_missing",
    });

    expect(result).toEqual(err({ message: "League not found: lea_missing" }));
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates a league lookup failure", async () => {
    const lookupError = err({ message: "Failed to get league by id" });
    const deps = makeDeps({ getLeagueById: vi.fn().mockResolvedValue(lookupError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(lookupError);
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("propagates an upsert failure", async () => {
    const upsertError = err({ message: "Failed to upsert subscription" });
    const deps = makeDeps({ upsertSubscription: vi.fn().mockResolvedValue(upsertError) });

    const result = await createSubscription({
      deps,
      clientName: "Williamstown SC",
      leagueId: "lea_abc123",
    });

    expect(result).toEqual(upsertError);
  });
});
