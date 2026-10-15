// Result -> HTTP response mapping — the one place that decides how a Result becomes a status
// code, so route handlers don't each repeat it.

import {
  createConsoleLogger,
  errorKindValue,
  type Result,
  type ResultError,
} from "@matchday/domain";
import type { Context, Env } from "hono";

function logFailure(event: string, error: ResultError): void {
  const logger = createConsoleLogger();
  logger.error(event, error.message, { cause: error.cause });
}

// No explicit return type below: annotating `: Response` would erase the precise per-status
// `TypedResponse` union `@hono/zod-openapi` checks handlers against.

/**
 * Maps a Result to 200 with its value, or to the status matching the failure's kind. Only
 * `ServerError` is logged and has its message withheld — every other kind is a deliberate,
 * client-facing outcome whose message is safe to return.
 *
 * Every route must spread `errorResponsesValue` into its `responses`, since this can emit any of
 * those statuses and `openapi()` rejects a handler returning one the route didn't declare.
 *
 * The trailing `never` assignment makes the `switch` exhaustive: adding an `ErrorKind` without a
 * case here is a type error on that line, rather than a fallthrough that returns `undefined` and
 * surfaces as an unreadable error at every `.openapi()` call site.
 */
export function jsonResult<E extends Env, T>(c: Context<E>, result: Result<T>, event: string) {
  if (result.ok) {
    return c.json(result.value, 200);
  }
  return failureResponse(c, result.error, event);
}

/** Like `jsonResult`, for a success with nothing to return: 204 with no body. Same failure
 * statuses, so a route spreads `errorResponsesValue` here too. */
export function noContentResult<E extends Env>(
  c: Context<E>,
  result: Result<unknown>,
  event: string,
) {
  if (result.ok) {
    return c.body(null, 204);
  }
  return failureResponse(c, result.error, event);
}

function failureResponse<E extends Env>(c: Context<E>, error: ResultError, event: string) {
  const { kind, message } = error;
  switch (kind) {
    case errorKindValue.notFound:
      return c.json({ error: message }, 404);
    case errorKindValue.badRequest:
      return c.json({ error: message }, 400);
    case errorKindValue.unauthorized:
      return c.json({ error: message }, 401);
    case errorKindValue.conflict:
      return c.json({ error: message }, 409);
    case errorKindValue.serverError:
      logFailure(event, error);
      return c.json({ error: "Internal server error" }, 500);
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
}
