import { verifyWebhookSignature } from "#webhook.ts";

const secret = "whsec_test_secret";
const body = '{"hasChanges":true,"leagueId":"lea_abc123"}';

async function sign(payload: string, signingSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", async () => {
    const header = `sha256=${await sign(body, secret)}`;

    const result = await verifyWebhookSignature(body, header, secret);

    expect(result).toBe(true);
  });

  it("rejects a body that was altered after signing", async () => {
    const header = `sha256=${await sign(body, secret)}`;
    const alteredBody = '{"hasChanges":false,"leagueId":"lea_abc123"}';

    const result = await verifyWebhookSignature(alteredBody, header, secret);

    expect(result).toBe(false);
  });

  it("rejects a signature produced under the wrong secret", async () => {
    const header = `sha256=${await sign(body, "whsec_wrong_secret")}`;

    const result = await verifyWebhookSignature(body, header, secret);

    expect(result).toBe(false);
  });

  it("rejects a missing header", async () => {
    const result = await verifyWebhookSignature(body, null, secret);

    expect(result).toBe(false);
  });

  it("rejects a malformed scheme", async () => {
    const header = `sha1=${await sign(body, secret)}`;

    const result = await verifyWebhookSignature(body, header, secret);

    expect(result).toBe(false);
  });

  it("rejects a malformed hexadecimal value", async () => {
    const header = "sha256=not-valid-hex";

    const result = await verifyWebhookSignature(body, header, secret);

    expect(result).toBe(false);
  });
});
