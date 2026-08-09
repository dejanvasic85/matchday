import { apiTokenSchema } from "./apiToken.ts";

function makeValidApiToken() {
  return {
    id: "tok_abc123",
    clientId: "cli_abc123",
    tokenHash: "a".repeat(64),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("apiTokenSchema", () => {
  it("accepts a valid, unrevoked api token", () => {
    const result = apiTokenSchema.safeParse(makeValidApiToken());

    expect(result.success).toBe(true);
  });

  it("accepts a revoked api token", () => {
    const result = apiTokenSchema.safeParse({ ...makeValidApiToken(), revokedAt: new Date() });

    expect(result.success).toBe(true);
  });

  it("rejects an api token missing its hash", () => {
    const { tokenHash: _tokenHash, ...withoutTokenHash } = makeValidApiToken();

    const result = apiTokenSchema.safeParse(withoutTokenHash);

    expect(result.success).toBe(false);
  });
});
