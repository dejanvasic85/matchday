// Bearer API token auth middleware (ADR 0013) — thin transport glue (AGENTS.md): builds the real
// db client, delegates the auth decision to apiTokenAuthService, and maps the Result to either
// `next()` (with the resolved client id on the context) or a 401.

import type { ClientId } from "@matchday/domain";
import { createDbClient } from "@matchday/db";
import { createMiddleware } from "hono/factory";
import { getApiConfig, type ApiBindings } from "../config.ts";
import { authenticateApiToken, createApiTokenAuthDeps } from "../services/apiTokenAuthService.ts";

export type ApiTokenAuthVariables = { clientId: ClientId };

export const apiTokenAuthMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: ApiTokenAuthVariables;
}>(async (c, next) => {
  const config = getApiConfig(c.env);
  const db = createDbClient(config.DATABASE_URL);
  const result = await authenticateApiToken(
    createApiTokenAuthDeps(db),
    c.req.header("Authorization"),
  );

  if (!result.ok) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("clientId", result.value);
  await next();
});
