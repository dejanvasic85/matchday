// Execute-and-capture wrapper every data-access function runs through: no query throws, and
// transient neon-http failures are retried with bounded backoff (safe — every caller is idempotent).

import { ok, serverError, type Result } from "@matchday/domain";
import { retryConfigValue } from "#constants.ts";

/** Transient iff no `sourceError` — the SQL never executed, vs. a real SQL error which must not be retried. */
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

  return serverError(message, lastCause);
}

/** Run an upsert (with retry, via {@link runQuery}) and unwrap its single `returning()` row,
 * failing if none came back. */
export async function runUpsert<T>(
  fn: () => Promise<T[]>,
  entityLabel: string,
  values: unknown,
): Promise<Result<T>> {
  const result = await runQuery(fn, `Failed to upsert ${entityLabel}`);
  if (!result.ok) {
    return result;
  }
  const row = result.value[0];
  if (row === undefined) {
    return serverError(`Upsert of ${entityLabel} returned no row`, values);
  }
  return ok(row);
}
