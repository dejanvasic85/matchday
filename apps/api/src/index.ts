// matchday REST API — Hono on Cloudflare Workers, REST + OpenAPI via @hono/zod-openapi (0007).
// Reaches Neon Postgres through the serverless driver (never raw pg TCP, 0009). Sentry captures
// errors/traces; Cloudflare Workers Logs captures console.warn/error (AGENTS.md structured
// logging).

import { OpenAPIHono } from "@hono/zod-openapi";
import { sentry } from "@sentry/hono/cloudflare";
import type { ApiBindings } from "#config.ts";
import { apiTokenAuthMiddleware, type ApiTokenAuthVariables } from "#middleware/apiTokenAuth.ts";
import { dbClientMiddleware, type DbVariables } from "#middleware/dbClient.ts";
import { clubRoute } from "#routes/clubRoute.ts";
import { competitionRoute } from "#routes/competitionRoute.ts";
import { healthRoute } from "#routes/healthRoute.ts";
import { leagueRoute } from "#routes/leagueRoute.ts";
import { seasonRoute } from "#routes/seasonRoute.ts";
import { teamRoute } from "#routes/teamRoute.ts";

type AppEnv = { Bindings: ApiBindings; Variables: DbVariables & ApiTokenAuthVariables };

const app = new OpenAPIHono<AppEnv>();

app.use(
  sentry(app, (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? "development",
    tracesSampleRate: 0.1,
  })),
);

// Builds the request's `Db` once, so every route/middleware downstream reads `c.get("db")`
// instead of each repeating `getApiConfig` + `createDbClient`. Runs before /health (which needs
// it for the readiness ping) and before the auth middleware (which needs it for the token
// lookup), so it must be the first thing registered after Sentry.
app.use("*", dbClientMiddleware);

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "Per-client API token (ADR 0013), issued via `mday api-token-create`.",
});

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "matchday API", version: "0.0.0" },
  security: [{ bearerAuth: [] }],
});

// /health and /openapi.json are public (a liveness probe and the API's own discovery document —
// consumers need the spec before they can even see there's a bearer scheme to use). Every other
// route requires a bearer API token (ADR 0013). Hono composes matched handlers in registration
// order, so a public route's own terminal handler runs (and returns) before reaching the wildcard
// auth middleware below it. IMPORTANT: any route registered ABOVE the app.use("*", ...) line
// bypasses auth the same way — new public routes must be added above it; new protected routes
// (the default, e.g. the resource routes below) must be added below it.
app.route("/health", healthRoute);
app.use("*", apiTokenAuthMiddleware);

app.route("/clubs", clubRoute);
app.route("/teams", teamRoute);
app.route("/competitions", competitionRoute);
app.route("/seasons", seasonRoute);
app.route("/leagues", leagueRoute);

export default app;
