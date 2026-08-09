// Bearer API token generation and hashing (ADR 0013). The plaintext token is shown to a client
// once, at creation time, and never persisted — only its hash is stored, and re-derived from the
// incoming `Authorization` header to look the token up on each request. Uses the Web Crypto API
// (`crypto` global) rather than `node:crypto` so this runs unmodified on Cloudflare Workers.

const tokenPrefixValue = "mday_";
const tokenByteLength = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate a new plaintext bearer token. Never stored as-is — only `hashApiToken` of it is. */
export function generateApiToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tokenByteLength));
  return `${tokenPrefixValue}${toHex(bytes)}`;
}

/** SHA-256 hash of a token, hex-encoded, for storage/lookup. */
export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}
