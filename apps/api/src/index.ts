// matchday REST API — Hono on Cloudflare Workers, REST + OpenAPI via @hono/zod-openapi (0007).
// Reaches Neon Postgres through the serverless driver (never raw pg TCP, 0009). Sentry captures
// errors/traces; Cloudflare Workers Logs captures console.warn/error (AGENTS.md structured
// logging). Resource routes land in Phase 4 (#45).

import { sentry } from "@sentry/hono/cloudflare";
import { Hono } from "hono";
import type { ApiBindings } from "./config.ts";
import { healthRoute } from "./routes/healthRoute.ts";

const app = new Hono<{ Bindings: ApiBindings }>();

app.use(
  sentry(app, (env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? "development",
    tracesSampleRate: 0.1,
  })),
);

app.route("/health", healthRoute);

export default app;
