import { parseEnv } from "@matchday/domain";
import { z } from "zod";

/**
 * Database environment. Used standalone (drizzle-kit migrations, scripts, tests). The API and
 * scraper apps validate `DATABASE_URL` through their own config; this schema exists so the db
 * package can resolve a connection string without depending on an app. Documented in
 * `packages/db/.env.example`.
 */
const dbEnvSchema = z.object({
  // Neon Postgres — reached via the serverless (neon-http) driver, never raw pg TCP.
  DATABASE_URL: z.url(),
});

export type DbConfig = z.infer<typeof dbEnvSchema>;

export function getDbConfig(source: Record<string, string | undefined>): DbConfig {
  return parseEnv(dbEnvSchema, source);
}
