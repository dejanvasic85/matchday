import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      // Wrangler (not Vite) bundles this Worker; `build` is a cacheable dry-run bundle check,
      // `dev`/`deploy` are side-effecting and uncached.
      dev: {
        command: "wrangler dev",
        cache: false,
      },
      build: {
        command: "wrangler deploy --dry-run --outdir dist",
      },
      deploy: {
        command: "wrangler deploy",
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
