// Execute-and-capture wrapper every data-access function runs through: no query throws, and
// transient neon-http failures are retried with bounded backoff (safe — every caller is idempotent).

import {
  backoffDelayMs,
  delay,
  describeCause,
  ok,
  serverError,
  type Result,
} from "@matchday/domain";
import { retryConfigValue } from "#constants.ts";
import { isTransientNeonError } from "#neonError.ts";

/** Execute `fn`, returning `ok` of its result or `err` on failure. Transient neon-http errors are
 * retried up to `maxAttempts` with jittered exponential backoff; other errors fail immediately. */
export async function runQuery<T>(fn: () => Promise<T>, message: string): Promise<Result<T>> {
  let lastCause: unknown;

  for (let attempt = 1; attempt <= retryConfigValue.maxAttempts; attempt += 1) {
    try {
      return ok(await fn());
    } catch (cause) {
      lastCause = cause;
      if (attempt >= retryConfigValue.maxAttempts || !isTransientNeonError(cause)) {
        break;
      }
      await delay(backoffDelayMs(attempt, retryConfigValue));
    }
  }

  return serverError(message, describeCause(lastCause));
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
