import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't autoload env files, so load `.env.local` for local `migrate`/`studio`
// runs. In CI the var comes from the environment (the GitHub secret), so the file is optional.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// `generate` diffs the schema and needs no connection, so pass the URL through unvalidated
// (real validation lives in `src/config.ts`) — `generate` still works without a live database.
const databaseUrl = process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: { url: databaseUrl },
});
