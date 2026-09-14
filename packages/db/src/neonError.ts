// What the neon-http driver throws, and how to read it. Kept apart from the retry loop in
// runQuery.ts so the driver's quirks live in one place.

import { transientHttpStatusValue } from "#constants.ts";

const proxyStatusPattern = /^Server error \(HTTP status (\d{3})\)/;

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isNeonDbError(cause: unknown): cause is object {
  return (
    typeof cause === "object" && cause !== null && Reflect.get(cause, "name") === "NeonDbError"
  );
}

/** The proxy's status survives only as message text. 5xx and 429 are blips worth another attempt;
 * a 4xx will fail the same way next time. */
function isTransientProxyStatus(cause: object): boolean {
  const message = Reflect.get(cause, "message");
  if (typeof message !== "string") {
    return false;
  }
  // No match leaves NaN, which compares false both ways — a message we don't recognise is not
  // something to retry.
  const status = Number(proxyStatusPattern.exec(message)?.[1]);
  return (
    status >= transientHttpStatusValue.serverErrorFloor ||
    status === transientHttpStatusValue.tooManyRequests
  );
}

/**
 * neon-http throws one error type for three very different failures, told apart like this:
 *
 * - `sourceError` set — `fetch` itself threw, so the SQL never reached Postgres. Transient.
 * - a `code` (SQLSTATE) — Postgres rejected the statement over HTTP 400. Retrying re-runs a
 *   statement the database already refused, so never retry these.
 * - neither — a non-400 response from Neon's proxy, whose status is only in the message.
 */
export function isTransientNeonError(cause: unknown): boolean {
  if (!isNeonDbError(cause)) {
    return false;
  }
  if (isPresent(Reflect.get(cause, "sourceError"))) {
    return true;
  }
  if (isPresent(Reflect.get(cause, "code"))) {
    return false;
  }
  return isTransientProxyStatus(cause);
}
