import { parseEnv } from "@matchday/domain";
import { z } from "zod";

/**
 * API environment. On Cloudflare Workers there is no `process.env`; the runtime passes
 * an `env` binding into the fetch handler. Call `getApiConfig(env)` once per request (or
 * once at startup for a long-lived Node process) with that record. Vars are documented in
 * `apps/api/.env.example`.
 */
const apiEnvSchema = z.object({
  // Neon Postgres — reached via the serverless driver / Hyperdrive, never raw pg TCP.
  DATABASE_URL: z.url(),
  // Comma-separated list of allowed origins for CORS; empty means same-origin only.
  ALLOWED_ORIGINS: z.string().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Sentry DSN (optional — Sentry no-ops when unset, so local dev doesn't need an account).
  SENTRY_DSN: z.string().optional(),
  // Sentry environment tag. wrangler.jsonc commits "production"; override to "development" in a
  // local .dev.vars so dev traffic doesn't get tagged as production in Sentry.
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

/** Raw Cloudflare Workers bindings (vars + secrets) as handed to the fetch handler, before Zod
 * validation — Hono's `Bindings` generic. Pass to `getApiConfig` to get a validated `ApiConfig`. */
export type ApiBindings = Record<string, string | undefined>;

export function getApiConfig(source: ApiBindings): ApiConfig {
  return parseEnv(apiEnvSchema, source);
}
