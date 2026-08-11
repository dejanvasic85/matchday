// Result -> HTTP response mapping (AGENTS.md: routes are glue) — the one place that decides how
// a Result becomes a status code and logs a failure, so route handlers don't each repeat it.
// The domain describes *what* went wrong via `error.kind`; this module is the only thing that
// knows which number that becomes.

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

// No explicit return type annotation below: `@hono/zod-openapi` type-checks a route handler's
// return value against that route's exact declared response union (`TypedResponse<Body, Status,
// "json">` per status). Annotating `: Response` here would erase that precision and break every
// call site's type-check — leaving it off lets TS infer the exact union straight from the
// `c.json(...)` calls, which stays specific to each call site's `T`.

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

  const { kind, message } = result.error;
  switch (kind) {
    case errorKindValue.notFound:
      return c.json({ error: message }, 404);
    case errorKindValue.badRequest:
      return c.json({ error: message }, 400);
    case errorKindValue.unauthorized:
      return c.json({ error: message }, 401);
    case errorKindValue.forbidden:
      return c.json({ error: message }, 403);
    case errorKindValue.conflict:
      return c.json({ error: message }, 409);
    case errorKindValue.serverError:
      logFailure(event, result.error);
      return c.json({ error: "Internal server error" }, 500);
    default: {
      const unhandled: never = kind;
      return unhandled;
    }
  }
}
