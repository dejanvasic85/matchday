// matchday REST API — Hono on Cloudflare Workers, REST + OpenAPI via @hono/zod-openapi (0007).
// Reaches Neon Postgres through the serverless driver (never raw pg TCP, 0009). Sentry captures
// errors/traces; Cloudflare Workers Logs captures console.warn/error (AGENTS.md structured
// logging). Resource routes land in Phase 4 (#45).

import { sentry } from "@sentry/hono/cloudflare";
import { Hono } from "hono";
import type { ApiBindings } from "./config.ts";
import { apiTokenAuthMiddleware, type ApiTokenAuthVariables } from "./middleware/apiTokenAuth.ts";
import { healthRoute } from "./routes/healthRoute.ts";

const app = new Hono<{ Bindings: ApiBindings; Variables: ApiTokenAuthVariables }>();

app.use(
  sentry(app, (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? "development",
    tracesSampleRate: 0.1,
  })),
);

// /health is a liveness/readiness probe and stays open; every other route requires a bearer API
// token (ADR 0013). Hono composes matched handlers in registration order, so /health's own
// terminal handler runs (and returns) before reaching the wildcard auth middleware below it.
// IMPORTANT: any route registered ABOVE the app.use("*", ...) line bypasses auth the same way —
// new public routes must be added above it (like /health); new protected routes (the default,
// e.g. #45's resource routes) must be added below it.
app.route("/health", healthRoute);
app.use("*", apiTokenAuthMiddleware);

export default app;
