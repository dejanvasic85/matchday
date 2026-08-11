/**
 * A `Result<T, E>` models success or failure as a value instead of throwing.
 * Data access returns `Result`; services map failures to domain outcomes.
 */
export type Result<T, E = ResultError> = { ok: true; value: T } | { ok: false; error: E };

/** Why a `Result` failed. The discriminator lives on the error rather than on the `Result` union
 * itself: `ok` already separates success from failure, so `kind` only needs to separate failures
 * from each other. Purely internal control flow — never persisted, never sent on the wire — so
 * the transport layer stays the only place that knows how a kind becomes a status code. */
export const errorKindValue = {
  serverError: "ServerError",
  notFound: "NotFound",
  badRequest: "BadRequest",
  unauthorized: "Unauthorized",
  conflict: "Conflict",
} as const;

export type ErrorKind = (typeof errorKindValue)[keyof typeof errorKindValue];

export type ResultError = {
  kind: ErrorKind;
  message: string;
  cause?: unknown;
};

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** An unexpected failure — a driver error, a failed validation of data we control, a broken
 * invariant. The only kind whose `message` the API keeps to itself (logged, not returned). */
export function serverError(message: string, cause?: unknown): Result<never, ResultError> {
  return err(
    cause === undefined
      ? { kind: errorKindValue.serverError, message }
      : { kind: errorKindValue.serverError, message, cause },
  );
}

/** The requested entity does not exist. Services return this instead of a `null` success value so
 * "absent" is a failure the caller must handle, not a value it can forget to check. */
export function notFound(message: string): Result<never, ResultError> {
  return err({ kind: errorKindValue.notFound, message });
}

/** The caller's input was invalid in a way schema validation could not catch. */
export function badRequest(message: string): Result<never, ResultError> {
  return err({ kind: errorKindValue.badRequest, message });
}

/** The caller could not be authenticated. Distinct from `serverError` so a failing token lookup
 * is never reported to the client as a rejected credential (ADR 0013). */
export function unauthorized(message: string): Result<never, ResultError> {
  return err({ kind: errorKindValue.unauthorized, message });
}

/** The request conflicts with existing state — a duplicate, or a violated uniqueness rule. */
export function conflict(message: string): Result<never, ResultError> {
  return err({ kind: errorKindValue.conflict, message });
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Convert a "found or not" data-access result into one where absence is a `NotFound` failure,
 * mapping the row through `fn` when present. Lets a service return `Result<T>` rather than
 * `Result<T | null>`, so callers cannot forget to handle the missing case. */
export function requireFound<T, U>(
  result: Result<T | null>,
  fn: (value: T) => U,
  notFoundMessage: string,
): Result<U> {
  if (!result.ok) {
    return result;
  }
  return result.value === null ? notFound(notFoundMessage) : ok(fn(result.value));
}

/** Apply `fn` to a success value, passing failures through unchanged. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/** Unwrap a success value, or return `fallback` on failure. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
