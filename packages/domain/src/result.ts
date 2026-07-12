/**
 * A `Result<T, E>` models success or failure as a value instead of throwing.
 * Data access returns `Result`; services map failures to domain outcomes.
 */
export type Result<T, E = ResultError> = { ok: true; value: T } | { ok: false; error: E };

export type ResultError = {
  message: string;
  cause?: unknown;
};

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Apply `fn` to a success value, passing failures through unchanged. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Unwrap a success value, or return `fallback` on failure. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
