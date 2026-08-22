import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["typescript"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // No `as` casting — hacks that hide runtime errors and defeat the type system.
      "typescript/consistent-type-assertions": "error",
      "typescript/no-unsafe-type-assertion": "error",
      // camelCase constants, never SCREAMING_CASE; object constants suffixed `Value`.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
    overrides: [
      {
        // Backend workspaces run in Node; console is the log transport.
        files: ["apps/**", "packages/**"],
        env: { node: true },
      },
      {
        files: ["**/*.test.ts", "**/*.spec.ts"],
        plugins: ["typescript", "vitest"],
        rules: {
          "typescript/no-unsafe-type-assertion": "off",
        },
      },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
  },
  staged: {
    "*.{js,ts,md}": "vp check --fix",
  },
  run: {
    cache: true,
  },
});
