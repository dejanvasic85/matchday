// The single execute-and-capture wrapper every data-access function runs through: it awaits the
// query, returns `ok(rows)`, and turns any driver error into `err({ message, cause })` — no query
// throws. It also transparently retries transient neon-http failures (dropped WebSocket, pooler
// hiccup) with bounded backoff, so a single flaky HTTP round-trip no longer aborts a long crawl.
// neon-http has no interactive transactions (ADR 0011); every caller is a single idempotent
// statement (a lookup or an upsert), so replaying one on a transient failure is always safe.

import { err, ok, type Result } from "@matchday/domain";
import { retryConfigValue } from "./constants.ts";

/** A neon-http error is transient when it carries no `sourceError` — i.e. the SQL never executed
 * (connection/HTTP-level failure) rather than a database rejecting a well-formed statement. A real
 * SQL error (constraint violation, bad type) carries `sourceError` and must not be retried. */
function isTransientDbError(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) {
    return false;
  }
  if (!("name" in cause) || cause.name !== "NeonDbError") {
    return false;
  }
  const sourceError = "sourceError" in cause ? cause.sourceError : undefined;
  return sourceError === undefined || sourceError === null || isEmptyObject(sourceError);
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value).length === 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Execute `fn`, returning `ok` of its result or `err` on failure. Transient neon-http errors are
 * retried up to `maxAttempts` with exponential backoff; other errors fail immediately. */
export async function runQuery<T>(fn: () => Promise<T>, message: string): Promise<Result<T>> {
  let lastCause: unknown;

  for (let attempt = 1; attempt <= retryConfigValue.maxAttempts; attempt += 1) {
    try {
      return ok(await fn());
    } catch (cause) {
      lastCause = cause;
      if (attempt >= retryConfigValue.maxAttempts || !isTransientDbError(cause)) {
        break;
      }
      await delay(retryConfigValue.baseDelayMs * 2 ** (attempt - 1));
    }
  }

  return err({ message, cause: lastCause });
}
