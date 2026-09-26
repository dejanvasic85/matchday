import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      // Wrangler (not Vite) bundles this Worker; `build` is a cacheable dry-run bundle check,
      // `dev`/`deploy` are side-effecting and uncached.
      dev: {
        command: "wrangler dev --env-file ../../.env",
        cache: false,
      },
      build: {
        command: "wrangler deploy --dry-run --outdir dist",
      },
      deploy: {
        command: "wrangler deploy",
        cache: false,
      },
      // Integration tests against a real Neon branch. Never cached (side effect) and run from
      // the package root so INTEGRATION_DATABASE_URL reaches the child Vitest process.
      "test:integration": {
        command: "vp test run test/integration",
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
