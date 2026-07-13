import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
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
