import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { isJsonObject } from "#scripts/json.ts";
import type { JsonValue } from "#scripts/json.ts";
import {
  branchName,
  isOwnBranchName,
  isProtectedBranch,
  machineId,
  neonBranchValue,
} from "#scripts/neonBranch.ts";

function neon(args: string[]): string {
  return execFileSync("neon", args, { encoding: "utf8" }).trim();
}

function deleteBranch(name: string): void {
  neon(["--project-id", neonBranchValue.projectId, "branches", "delete", name]);
}

/** Only this machine's non-protected branches are ever deleted. */
export function canRemoveBranch(name: string, prefix: string): boolean {
  return isOwnBranchName(name, prefix) && !isProtectedBranch(name);
}

/** Deletes one named branch when it exists and belongs to this machine. */
export function removeNamedBranch(name: string, prefix: string, dryRun: boolean): boolean {
  if (!canRemoveBranch(name, prefix)) {
    console.warn(`Refusing to delete ${name}: not a branch of this machine.`);
    return false;
  }
  if (!listBranchNames().includes(name)) {
    console.log(`No Neon branch named ${name}.`);
    return false;
  }
  if (dryRun) {
    console.log(`Would delete ${name}`);
    return true;
  }
  deleteBranch(name);
  console.log(`Deleted ${name}`);
  return true;
}

function listBranchNames(): string[] {
  const parsed: JsonValue = JSON.parse(
    neon(["--project-id", neonBranchValue.projectId, "branches", "list", "--output", "json"]),
  );
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((branch) => (isJsonObject(branch) ? branch["name"] : undefined))
    .filter((name): name is string => name !== undefined);
}

/** Branch names are slugged, so compare slugs rather than reversing the transform. */
function liveBranchNames(): Set<string> {
  const refs = execFileSync("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], {
    encoding: "utf8",
  });
  return new Set(
    refs
      .split("\n")
      .filter((ref) => ref !== "")
      .map((ref) => branchName(ref)),
  );
}

/**
 * This machine's branches whose git branch has gone. Another machine's branches are never
 * this machine's to delete, whatever their git branch does.
 */
export function staleBranches(
  names: readonly string[],
  live: ReadonlySet<string>,
  prefix: string,
): string[] {
  return names.filter((name) => canRemoveBranch(name, prefix) && !live.has(name));
}

/** Expiry is the real backstop; this just reclaims branches whose git branch has gone. */
export function cleanBranches(dryRun: boolean): void {
  const stale = staleBranches(listBranchNames(), liveBranchNames(), `${machineId()}/`);

  if (stale.length === 0) {
    console.log("No stale branches for this machine.");
    return;
  }

  for (const name of stale) {
    if (dryRun) {
      console.log(`Would delete ${name}`);
      continue;
    }
    deleteBranch(name);
    console.log(`Deleted ${name}`);
  }
}

// Importable for tests: only run when invoked directly.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  cleanBranches(process.argv.includes("--dry-run"));
}
