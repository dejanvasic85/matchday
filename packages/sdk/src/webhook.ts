// Verifies a matchday webhook delivery against its `X-Matchday-Signature` header. Deliberately not
// imported from @matchday/domain (that package is an unpublished workspace dependency) — the SDK
// carries its own copy of the same HMAC-SHA256-over-the-raw-body contract, built with Web Crypto so
// it runs anywhere: browsers, Workers, Node.

const signatureHeaderPattern = /^sha256=([0-9a-f]+)$/i;

function toBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      return null;
    }
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Verifies that `rawBody` was signed by `secret`, matching the `sha256=<hex>` value matchday sent
 * in `X-Matchday-Signature`. Uses `crypto.subtle.verify` so the comparison runs in constant time —
 * never compare the header to a locally-computed signature with `===` or a hand-rolled loop.
 *
 * `rawBody` must be the exact bytes matchday signed — the request body as received, before any
 * `JSON.parse`/`JSON.stringify` round trip, which can reorder keys or reformat numbers and change
 * what gets verified.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (signatureHeader === null) {
    return false;
  }

  const match = signatureHeaderPattern.exec(signatureHeader);
  if (!match) {
    return false;
  }

  const signatureHex = match[1];
  if (signatureHex === undefined) {
    return false;
  }

  const signatureBytes = toBytes(signatureHex);
  if (!signatureBytes) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(rawBody));
}
