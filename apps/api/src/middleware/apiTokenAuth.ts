// Bearer API token auth middleware (ADR 0013) — thin transport glue (AGENTS.md): reads the
// request's `db` (set by dbClientMiddleware), delegates the auth decision to
// apiTokenAuthService, and maps the Result to `next()` (with the resolved client id on the
// context), a 401, or a logged 500. A rejected credential and an unreachable token store are
// different failures: only the former is the client's problem.

import { createConsoleLogger, errorKindValue, type ClientId } from "@matchday/domain";
import { createMiddleware } from "hono/factory";
import type { ApiBindings } from "#config.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import { authenticateApiToken, createApiTokenAuthDeps } from "#services/apiTokenAuthService.ts";

export type ApiTokenAuthVariables = { clientId: ClientId };

export const apiTokenAuthMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: DbVariables & ApiTokenAuthVariables;
}>(async (c, next) => {
  const result = await authenticateApiToken(
    createApiTokenAuthDeps(c.get("db")),
    c.req.header("Authorization"),
  );

  // Mirrors the Unauthorized/ServerError arms of `jsonResult` (resultResponse.ts) — middleware
  // runs outside a `createRoute`, so it can't share that helper. Keep the two in sync.
  if (!result.ok) {
    if (result.error.kind === errorKindValue.unauthorized) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    createConsoleLogger().error("api.auth.failed", result.error.message, {
      cause: result.error.cause,
    });
    return c.json({ error: "Internal server error" }, 500);
  }

  c.set("clientId", result.value);
  await next();
});
