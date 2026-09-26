import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fail, replaceDatabaseUrl } from "#scripts/env.ts";
import { cappedExpiryDays, ensureBranch, runWhileBranchWakes } from "#scripts/neonBranch.ts";

const useBranchValue = {
  defaultExpiryDays: 7,
  // Migrations live in the db package; this runs from the workspace root.
  migrateCommand: ["vp", "run", "--filter", "@matchday/db", "db:migrate"],
} as const;

const rootEnvPath = fileURLToPath(new URL("../.env", import.meta.url));

function currentGitBranch(): string {
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
}

function writeDatabaseUrl(databaseUrl: string): void {
  writeFileSync(rootEnvPath, replaceDatabaseUrl(readFileSync(rootEnvPath, "utf8"), databaseUrl));
}

function useOwnBranch(days: number): void {
  if (!existsSync(rootEnvPath)) {
    fail("No .env at the repo root. Copy .env.example to .env first.");
  }

  const gitBranch = currentGitBranch();
  if (gitBranch === "HEAD") {
    fail("Detached HEAD has no branch name to derive a database from.");
  }

  const { name, databaseUrl } = ensureBranch(gitBranch, days);
  writeDatabaseUrl(databaseUrl);

  // This process already loaded the root .env, whose old DATABASE_URL would otherwise win.
  // Migrations must run against the new branch, never the parent.
  runWhileBranchWakes(useBranchValue.migrateCommand, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  console.log(
    `\n.env now points at ${name}, migrated and expiring in ${String(cappedExpiryDays(days))} days.`,
  );
}

const args = process.argv.slice(2);
const daysIndex = args.indexOf("--days");
const days = daysIndex === -1 ? useBranchValue.defaultExpiryDays : Number(args[daysIndex + 1]);

useOwnBranch(Number.isFinite(days) ? days : useBranchValue.defaultExpiryDays);
