import { generateWebhookSecret, signWebhookPayload } from "#webhookSignature.ts";

describe("generateWebhookSecret", () => {
  it("generates a secret with the whsec_ prefix", () => {
    const secret = generateWebhookSecret();

    expect(secret.startsWith("whsec_")).toBe(true);
  });

  it("generates a unique secret on each call", () => {
    const first = generateWebhookSecret();
    const second = generateWebhookSecret();

    expect(first).not.toEqual(second);
  });
});

describe("signWebhookPayload", () => {
  it("signs the same payload + secret to the same value", async () => {
    const secret = generateWebhookSecret();

    const first = await signWebhookPayload("{}", secret);
    const second = await signWebhookPayload("{}", secret);

    expect(first).toEqual(second);
  });

  it("signs different payloads to different values", async () => {
    const secret = generateWebhookSecret();

    const first = await signWebhookPayload('{"hasChanges":true}', secret);
    const second = await signWebhookPayload('{"hasChanges":false}', secret);

    expect(first).not.toEqual(second);
  });

  it("signs the same payload differently under different secrets", async () => {
    const payload = '{"hasChanges":true}';

    const first = await signWebhookPayload(payload, generateWebhookSecret());
    const second = await signWebhookPayload(payload, generateWebhookSecret());

    expect(first).not.toEqual(second);
  });

  it("produces a 64-character hex digest (HMAC-SHA256)", async () => {
    const signature = await signWebhookPayload("{}", generateWebhookSecret());

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });
});
