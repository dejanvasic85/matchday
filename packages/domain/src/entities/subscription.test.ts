import { subscriptionSchema } from "#entities/subscription.ts";

function makeValidSubscription() {
  return {
    id: "sub_abc123",
    clientId: "cli_abc123",
    leagueId: "lea_abc123",
    webhookUrl: null,
    webhookSecret: null,
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

  it("rejects a subscription missing clientId", () => {
    const { clientId: _clientId, ...withoutClientId } = makeValidSubscription();

    const result = subscriptionSchema.safeParse(withoutClientId);

    expect(result.success).toBe(false);
  });
});
