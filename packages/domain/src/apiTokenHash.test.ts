import { generateApiToken, hashApiToken } from "./apiTokenHash.ts";

describe("generateApiToken", () => {
  it("generates a token with the mday_ prefix", () => {
    const token = generateApiToken();

    expect(token.startsWith("mday_")).toBe(true);
  });

  it("generates a unique token on each call", () => {
    const first = generateApiToken();
    const second = generateApiToken();

    expect(first).not.toEqual(second);
  });
});

describe("hashApiToken", () => {
  it("hashes the same token to the same value", async () => {
    const token = generateApiToken();

    const first = await hashApiToken(token);
    const second = await hashApiToken(token);

    expect(first).toEqual(second);
  });

  it("hashes different tokens to different values", async () => {
    const first = await hashApiToken(generateApiToken());
    const second = await hashApiToken(generateApiToken());

    expect(first).not.toEqual(second);
  });

  it("produces a 64-character hex digest (SHA-256)", async () => {
    const hash = await hashApiToken(generateApiToken());

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
