// What the neon-http driver throws, and how to read it. Kept apart from the retry loop in
// runQuery.ts so the driver's quirks live in one place.

import { maxCauseDepth, transientHttpStatusValue } from "#constants.ts";

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

/** Errors JSON.stringify to `{}` — `message` and friends are non-enumerable — which is how a
 * production failure logged as `sourceError:{}` and said nothing. Flatten to a plain object. */
export function describeCause(cause: unknown, depth = 0): unknown {
  if (!(cause instanceof Error)) {
    return cause;
  }
  // Own entries cover every field neon-http copies off a Postgres error (code, constraint,
  // table, ...) with no hand-kept list to drift; `name` and `message` are never among them.
  const described: Record<string, unknown> = Object.fromEntries(Object.entries(cause));
  described.name = cause.name;
  described.message = cause.message;
  // Those entries carried these raw, which would drag the whole object graph — and any cycle in
  // it — into the log line. Re-add them below, flattened and depth-bounded.
  delete described.sourceError;
  delete described.cause;
  if (depth >= maxCauseDepth) {
    return described;
  }
  const sourceError = Reflect.get(cause, "sourceError");
  if (sourceError !== undefined) {
    described.sourceError = describeCause(sourceError, depth + 1);
  }
  if (cause.cause !== undefined) {
    described.cause = describeCause(cause.cause, depth + 1);
  }
  return described;
}
