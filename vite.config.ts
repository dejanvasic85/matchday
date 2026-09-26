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
        // Repo-root dev scripts print to stdout for the operator; Node env for their imports.
        files: ["scripts/**"],
        env: { node: true },
        rules: { "no-console": "off" },
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
    // Root scripts are a workspace of one; package tests run from their own configs.
    include: ["scripts/**/*.{test,spec}.ts"],
  },
  staged: {
    "*.{js,ts,md}": "vp check --fix",
  },
  run: {
    cache: true,
    tasks: {
      // Root scripts' tests, picked up by `vp run -r test` alongside every package.
      test: {
        command: "vp test run",
        input: [{ auto: true }],
      },
      // Points the root .env at this git branch's own Neon database. Talks to the Neon
      // CLI, so it never caches.
      "db:branch": {
        command: "pnpm run db:branch:run",
        cache: false,
      },
      "db:branch:clean": {
        command: "pnpm run db:branch:clean:run",
        cache: false,
      },
    },
  },
});
