import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig, type Plugin } from "vite-plus";

/** Walk up from `fromDir` to find the nearest ancestor containing a package.json. */
function findPackageRoot(fromDir: string): string {
  let dir = fromDir;
  while (!existsSync(join(dir, "package.json"))) {
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`No package.json found above ${fromDir}`);
    }
    dir = parent;
  }
  return dir;
}

/** Resolves "@/x" to "x" relative to the importing file's own package root, so each workspace
 * package gets its own package-scoped alias without per-package config. */
function packageRootAliasPlugin(): Plugin {
  return {
    name: "matchday-package-root-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.startsWith("@/") || importer === undefined) {
        return null;
      }
      const packageRoot = findPackageRoot(dirname(importer));
      return join(packageRoot, source.slice("@/".length));
    },
  };
}

export default defineConfig({
  plugins: [packageRootAliasPlugin()],
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
    "*.{js,ts}": "vp check --fix",
  },
  run: {
    cache: true,
  },
});
