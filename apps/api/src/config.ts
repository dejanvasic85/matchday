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
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;

export function getApiConfig(source: Record<string, string | undefined>): ApiConfig {
  return parseEnv(apiEnvSchema, source);
}
