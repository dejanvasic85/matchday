import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      mday: {
        command: "node --env-file-if-exists=.env.local src/cli.ts",
        // Crawl commands are side effects against a live DB/R2 — never cache/replay a run
        // (mirrors packages/db's db:migrate task).
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
