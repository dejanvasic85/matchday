import { OpenAPIHono } from "@hono/zod-openapi";
import { sentry } from "@sentry/hono/cloudflare";
import type { ApiBindings } from "#config.ts";
import { apiTokenAuthMiddleware, type ApiTokenAuthVariables } from "#middleware/apiTokenAuth.ts";
import { dbClientMiddleware, type DbVariables } from "#middleware/dbClient.ts";
import { cacheTtlValue, edgeCache } from "#middleware/edgeCache.ts";
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

// Builds the request's `Db` once for downstream `c.get("db")` reads; must run before /health and
// auth middleware, which both need it.
app.use("*", dbClientMiddleware);

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "Per-client API token, issued via `mday api-token-create`.",
});

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "matchday API", version: "0.0.0" },
  security: [{ bearerAuth: [] }],
});

// /health and /openapi.json are public; every other route requires a bearer token.
// IMPORTANT: routes registered above app.use("*", authMiddleware) bypass auth.
app.route("/health", healthRoute);
app.use("*", apiTokenAuthMiddleware);

// Cache TTLs follow each resource's crawl cadence. /leagues carries both: its own
// catalog data plus nested fixtures/table, so it takes the shorter match-data TTL.
// Both forms per resource: Hono's `/clubs/*` matches `/clubs/{id}` but not the `/clubs` list.
for (const path of ["/clubs", "/teams", "/competitions", "/seasons"]) {
  app.use(path, edgeCache(cacheTtlValue.catalog));
  app.use(`${path}/*`, edgeCache(cacheTtlValue.catalog));
}
app.use("/leagues", edgeCache(cacheTtlValue.matchData));
app.use("/leagues/*", edgeCache(cacheTtlValue.matchData));

app.route("/clubs", clubRoute);
app.route("/teams", teamRoute);
app.route("/competitions", competitionRoute);
app.route("/seasons", seasonRoute);
app.route("/leagues", leagueRoute);

export default app;
