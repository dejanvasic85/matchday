import { defineConfig } from "drizzle-kit";

// drizzle-kit reads env at CLI time. `generate` diffs the schema and needs no connection;
// `migrate` connects using DATABASE_URL. Validation of the URL for the app runtime lives in
// `src/config.ts`; here we pass it through so `generate` works even without a live database.
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
