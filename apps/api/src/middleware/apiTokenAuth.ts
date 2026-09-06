// Bearer API token auth middleware — delegates the auth decision to
// apiTokenAuthService; a rejected credential and an unreachable token store are different failures.

import { createConsoleLogger, errorKindValue, type ClientId } from "@matchday/domain";
import { createMiddleware } from "hono/factory";
import type { ApiBindings } from "#config.ts";
import type { DbVariables } from "#middleware/dbClient.ts";
import {
  authenticateApiToken,
  createApiTokenAuthDeps,
  recordApiTokenUse,
  type ApiTokenAuthDeps,
  type AuthenticatedApiToken,
} from "#services/apiTokenAuthService.ts";

export type ApiTokenAuthVariables = { clientId: ClientId };

/** A stamp that doesn't land only costs us a stale "last used" date, so it warns and moves on
 * rather than failing a request that has already been authorised. */
async function stampUsage(deps: ApiTokenAuthDeps, authenticated: AuthenticatedApiToken) {
  const stamped = await recordApiTokenUse(deps, authenticated, new Date());
  if (!stamped.ok) {
    createConsoleLogger().warn("api.auth.usagestamp", stamped.error.message, {
      cause: stamped.error.cause,
      tokenId: authenticated.tokenId,
    });
  }
}

export const apiTokenAuthMiddleware = createMiddleware<{
  Bindings: ApiBindings;
  Variables: DbVariables & ApiTokenAuthVariables;
}>(async (c, next) => {
  const deps = createApiTokenAuthDeps(c.get("db"));
  const result = await authenticateApiToken(deps, c.req.header("Authorization"));

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

  c.set("clientId", result.value.clientId);

  // Off the response path: the caller waits for their data, not for a usage stamp. The service
  // skips the write entirely while the stored stamp is still fresh.
  c.executionCtx.waitUntil(stampUsage(deps, result.value));

  await next();
});
