// Bearer API token auth middleware (ADR 0013) — thin transport glue (AGENTS.md): reads the
// request's `db` (set by dbClientMiddleware), delegates the auth decision to
// apiTokenAuthService, and maps the Result to either `next()` (with the resolved client id on
// the context) or a 401.

import type { ClientId } from "@matchday/domain";
import { createMiddleware } from "hono/factory";
import type { ApiBindings } from "@/config.ts";
import type { DbVariables } from "@/middleware/dbClient.ts";
import { authenticateApiToken, createApiTokenAuthDeps } from "@/services/apiTokenAuthService.ts";

export type ApiTokenAuthVariables = { clientId: ClientId };

export const apiTokenAuthMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: DbVariables & ApiTokenAuthVariables;
}>(async (c, next) => {
  const result = await authenticateApiToken(
    createApiTokenAuthDeps(c.get("db")),
    c.req.header("Authorization"),
  );

  if (!result.ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("clientId", result.value);
  await next();
});
