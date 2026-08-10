// Result -> HTTP response mapping (AGENTS.md: routes are glue) — the one place that decides how
// a Result becomes a status code and logs a failure, so route handlers don't each repeat it.

import { createConsoleLogger, type Result, type ResultError } from "@matchday/domain";
import type { Context, Env } from "hono";

function logFailure(event: string, error: ResultError): void {
  const logger = createConsoleLogger();
  logger.error(event, error.message, { cause: error.cause });
}

// No explicit return type annotation on either function below: `@hono/zod-openapi` type-checks a
// route handler's return value against that route's exact declared response union
// (`TypedResponse<Body, Status, "json">` per status). Annotating `: Response` here would erase
// that precision and break every call site's type-check — leaving it off lets TS infer the exact
// union straight from the `c.json(...)` calls, which stays specific to each call site's `T`.

/** Maps a Result to 200 (value) or 500 (logged failure) — for list/collection endpoints, where
 * there's no "not found" case. */
export function jsonResult<E extends Env, T>(c: Context<E>, result: Result<T>, event: string) {
  if (!result.ok) {
    logFailure(event, result.error);
    return c.json({ error: "Internal server error" }, 500);
  }
  return c.json(result.value, 200);
}

/** Maps a Result to 200 (value), 404 (null value), or 500 (logged failure) — for get-by-id
 * endpoints. */
export function jsonResultOrNotFound<E extends Env, T>(
  c: Context<E>,
  result: Result<T | null>,
  event: string,
  notFoundMessage: string,
) {
  if (!result.ok) {
    logFailure(event, result.error);
    return c.json({ error: "Internal server error" }, 500);
  }
  if (result.value === null) {
    return c.json({ error: notFoundMessage }, 404);
  }
  return c.json(result.value, 200);
}
