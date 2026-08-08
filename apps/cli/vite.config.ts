import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) }],
  },
  run: {
    tasks: {
      mday: {
        command: "node --env-file-if-exists=.env.local src/cli.ts",
        // Crawl commands are side effects against a live DB/R2, not a pure function of inputs
        // — never cache/replay a run, and uncached tasks get the full environment (DATABASE_URL,
        // R2 creds, DRIBL_*) rather than the cache-fingerprinting allowlist (mirrors
        // packages/db's db:migrate task).
        cache: false,
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    passWithNoTests: true,
  },
});
