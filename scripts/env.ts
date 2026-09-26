import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../.env", import.meta.url));

// The same fallback drizzle.config.ts uses: one .env at the repo root, unless the
// environment already carries the connection string (then CI wins).
export function loadRootEnv(): void {
  if (process.env["DATABASE_URL"] || !existsSync(rootEnvPath)) {
    return;
  }
  process.loadEnvFile(rootEnvPath);
}

const databaseUrlKeyValue = "DATABASE_URL";

/** Rewrites one key, so every other value in .env survives untouched. */
export function replaceEnvValue(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`;
}

export function replaceDatabaseUrl(contents: string, databaseUrl: string): string {
  return replaceEnvValue(contents, databaseUrlKeyValue, databaseUrl);
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
