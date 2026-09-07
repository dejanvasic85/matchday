import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const rootEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));

// drizzle-kit doesn't autoload env files. An already-set DATABASE_URL wins, as CI relies on.
if (!process.env.DATABASE_URL && existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
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
