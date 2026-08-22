import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
  },
  run: {
    tasks: {
      "db:migrate": {
        command: "drizzle-kit migrate",
        // Migrations are a side effect against a live database — never cache/replay a run.
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
