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
  },
});
