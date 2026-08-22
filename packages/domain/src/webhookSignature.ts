// Webhook secret generation + HMAC signing (#105), stored in plaintext (unlike an API token —
// we're the ones signing). Uses Web Crypto (not `node:crypto`) to run unmodified on Workers.

const webhookSecretPrefixValue = "whsec_";
const webhookSecretByteLength = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate a new webhook signing secret, shown once at `mday client set-webhook` time. */
export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(webhookSecretByteLength));
  return `${webhookSecretPrefixValue}${toHex(bytes)}`;
}

/** HMAC-SHA256 of `payload` under `secret`, hex-encoded — the value sent as the
 * `X-Matchday-Signature` header (`sha256=<hex>`) alongside a webhook delivery. */
export async function signWebhookPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(signature));
}
