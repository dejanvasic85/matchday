import { subscriptionSchema } from "./subscription.ts";

function makeValidSubscription() {
  return {
    id: "sub_abc123",
    clientName: "Williamstown SC",
    leagueId: "lea_abc123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("subscriptionSchema", () => {
  it("accepts a valid subscription", () => {
    const result = subscriptionSchema.safeParse(makeValidSubscription());

    expect(result.success).toBe(true);
  });

  it("rejects a subscription missing leagueId", () => {
    const { leagueId: _leagueId, ...withoutLeagueId } = makeValidSubscription();

    const result = subscriptionSchema.safeParse(withoutLeagueId);

    expect(result.success).toBe(false);
  });

  it("rejects a subscription missing clientName", () => {
    const { clientName: _clientName, ...withoutClientName } = makeValidSubscription();

    const result = subscriptionSchema.safeParse(withoutClientName);

    expect(result.success).toBe(false);
  });
});
