import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { fail } from "#scripts/env.ts";
import { branchName, isProtectedBranch, machineId } from "#scripts/neonBranch.ts";
import { cleanBranches, removeNamedBranch } from "#scripts/neonBranchClean.ts";
import { findMainRoot, targetPath } from "#scripts/worktree.ts";

const removeValue = {
  remote: "origin",
  usage: "Usage: vp run wt:remove <branch> [--force] [--no-db] [--dry-run]",
} as const;

type RemoveOptions = { force: boolean; keepDatabase: boolean; dryRun: boolean };
type RemoveArgs = RemoveOptions & { branch?: string };

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitInherit(args: string[]): void {
  execFileSync("git", args, { stdio: "inherit" });
}

/** Shared and CI branches are refused before anything is read or deleted. */
export function removalRefusal(branch: string): string | undefined {
  if (branch.trim() === "") {
    return removeValue.usage;
  }
  if (isProtectedBranch(branch)) {
    return `${branch} is protected and is never removed.`;
  }
  return undefined;
}

export function parseRemoveArgs(argv: string[]): RemoveArgs {
  const args = argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));

  return {
    branch: positional[0],
    force: args.includes("--force"),
    keepDatabase: args.includes("--no-db"),
    dryRun: args.includes("--dry-run"),
  };
}

function localBranchExists(branch: string): boolean {
  try {
    git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

function worktreeRegistered(path: string): boolean {
  return git(["worktree", "list", "--porcelain"])
    .split("\n")
    .some((line) => line === `worktree ${path}`);
}

function removeWorktree(path: string, options: RemoveOptions): void {
  if (!worktreeRegistered(path)) {
    console.log(`No worktree at ${path}.`);
    return;
  }
  if (options.dryRun) {
    console.log(`Would remove worktree ${path}`);
    return;
  }
  gitInherit(["worktree", "remove", ...(options.force ? ["--force"] : []), path]);
}

function deleteLocalBranch(branch: string, options: RemoveOptions): void {
  if (!localBranchExists(branch)) {
    console.log(`No local branch ${branch}.`);
    return;
  }
  if (options.dryRun) {
    console.log(`Would delete branch ${branch}`);
    return;
  }
  gitInherit(["branch", options.force ? "-D" : "-d", branch]);
}

/** Reclaims the exact Neon branch and sweeps any other stale ones of this machine. */
function reclaimDatabase(branch: string, dryRun: boolean): void {
  removeNamedBranch(branchName(branch), `${machineId()}/`, dryRun);
  cleanBranches(dryRun);
}

function removeTask(branch: string, options: RemoveOptions): void {
  const refusal = removalRefusal(branch);
  if (refusal !== undefined) {
    fail(refusal);
  }

  const path = targetPath(findMainRoot(), branch);
  removeWorktree(path, options);
  deleteLocalBranch(branch, options);

  if (!options.dryRun) {
    try {
      git(["fetch", "--prune", removeValue.remote]);
    } catch {
      // Offline is no reason to abandon the database cleanup; expiry is the backstop.
      console.warn(`Could not prune ${removeValue.remote}; continuing.`);
    }
  }
  if (!options.keepDatabase) {
    reclaimDatabase(branch, options.dryRun);
  }
}

function main(): void {
  const args = parseRemoveArgs(process.argv);
  if (!args.branch) {
    fail(removeValue.usage);
  }

  removeTask(args.branch, args);
}

// Importable for tests: only run when invoked directly.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  main();
}
