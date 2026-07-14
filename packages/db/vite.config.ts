import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
  },
  run: {
    tasks: {
      "db:migrate": {
        command: "drizzle-kit migrate",
        // Migrations are a side effect against a live database, not a pure function of
        // inputs — never cache/replay a run, and uncached tasks get the full environment
        // (including DATABASE_URL) rather than the cache-fingerprinting allowlist.
        cache: false,
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    passWithNoTests: true,
    coverage: {
      // Declarative schema + thin connection wiring; unit tests cover config + query mapping.
      exclude: ["src/schema.ts", "src/client.ts", "drizzle.config.ts"],
    },
  },
});
