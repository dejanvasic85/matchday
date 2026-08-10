import { join } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: join(import.meta.dirname, "src") }],
  },
  run: {
    tasks: {
      // Cloudflare Workers apps are bundled by Wrangler itself (esbuild), not the Vite build.
      // `build` is a deterministic dry-run bundle check (cacheable, catches Workers-incompatible
      // code in CI); `dev`/`deploy` are side-effecting/long-running, uncached like apps/cli's
      // `mday` task.
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
