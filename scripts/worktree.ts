import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

import { databaseUrlKeyValue, replaceDatabaseUrl } from "#scripts/env.ts";
import { cappedExpiryDays, ensureBranch, runWhileBranchWakes } from "#scripts/neonBranch.ts";

const worktreeValue = {
  baseBranch: "main",
  envFileName: ".env",
  installCommand: ["vp", "install"],
  // packages/sdk exports from dist, which is gitignored, so a fresh worktree cannot
  // type-check until the packages are built.
  buildCommand: ["vp", "run", "--filter", "./packages/*", "build"],
  migrateCommand: ["vp", "run", "--filter", "@matchday/db", "db:migrate"],
  defaultExpiryDays: 7,
} as const;

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** The common dir lives in the main checkout, so this works from any worktree. */
export function findMainRoot(): string {
  return dirname(resolve(git(["rev-parse", "--git-common-dir"])));
}

function branchExists(branch: string): boolean {
  try {
    git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

/** Branch from the fetched remote, so a new worktree never starts on a stale main. */
function resolveBase(): string {
  const remote = `origin/${worktreeValue.baseBranch}`;
  try {
    git(["fetch", "origin", worktreeValue.baseBranch]);
    return git(["rev-parse", "--verify", remote]) ? remote : worktreeValue.baseBranch;
  } catch {
    console.warn(`Could not fetch ${remote}, branching from local ${worktreeValue.baseBranch}.`);
    return worktreeValue.baseBranch;
  }
}

export function targetPath(mainRoot: string, branch: string): string {
  const slug = branch.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return resolve(mainRoot, "..", `${basename(mainRoot)}-${slug}`);
}

function addWorktree(path: string, branch: string): void {
  const args = branchExists(branch)
    ? ["worktree", "add", path, branch]
    : ["worktree", "add", "-b", branch, path, resolveBase()];
  execFileSync("git", args, { stdio: "inherit" });
}

/** Every worktree needs its own .env, and it is not in git. */
function linkEnv(mainRoot: string, path: string): void {
  const source = resolve(mainRoot, worktreeValue.envFileName);
  const link = resolve(path, worktreeValue.envFileName);

  if (!existsSync(source)) {
    console.warn(`No ${worktreeValue.envFileName} in ${mainRoot}, skipping the link.`);
    return;
  }
  if (lstatSync(link, { throwIfNoEntry: false })) {
    return;
  }
  symlinkSync(relative(dirname(link), source), link);
}

/** A real file, not a symlink: the worktree needs its own DATABASE_URL. */
function writeEnv(mainRoot: string, path: string, databaseUrl: string): void {
  const source = resolve(mainRoot, worktreeValue.envFileName);
  const target = resolve(path, worktreeValue.envFileName);

  if (!existsSync(source)) {
    console.warn(
      `No ${worktreeValue.envFileName} in ${mainRoot}, writing one with only the connection string.`,
    );
    writeFileSync(target, `${databaseUrlKeyValue}=${databaseUrl}\n`);
    return;
  }
  writeFileSync(target, replaceDatabaseUrl(readFileSync(source, "utf8"), databaseUrl));
}

function run(command: readonly string[], path: string): void {
  const [binary, ...args] = command;
  if (binary === undefined) {
    throw new Error("A command requires a binary.");
  }
  execFileSync(binary, args, { cwd: path, stdio: "inherit" });
}

type WorktreeDatabase = { name: string; databaseUrl: string };

function setUpDatabase(
  mainRoot: string,
  path: string,
  branch: string,
  days: number,
): WorktreeDatabase | undefined {
  try {
    const { name, databaseUrl } = ensureBranch(branch, days);
    writeEnv(mainRoot, path, databaseUrl);
    return { name, databaseUrl };
  } catch (error) {
    console.warn(
      `Could not prepare a Neon branch (${String(error)}), falling back to the shared .env.`,
    );
    linkEnv(mainRoot, path);
    return undefined;
  }
}

/** Returns the Neon branch when one was prepared, undefined when the shared .env is used. */
function prepareEnv(
  mainRoot: string,
  path: string,
  branch: string,
  options: { database: boolean; days: number },
): WorktreeDatabase | undefined {
  if (!options.database) {
    linkEnv(mainRoot, path);
    return undefined;
  }
  return setUpDatabase(mainRoot, path, branch, options.days);
}

function createWorktree(branch: string, options: { database: boolean; days: number }): void {
  const mainRoot = findMainRoot();
  const path = targetPath(mainRoot, branch);

  if (existsSync(path)) {
    console.error(`${path} already exists.`);
    process.exit(1);
  }

  addWorktree(path, branch);
  const database = prepareEnv(mainRoot, path, branch, options);

  run(worktreeValue.installCommand, path);
  run(worktreeValue.buildCommand, path);

  if (database !== undefined) {
    // This process has the main checkout's .env loaded, and an inherited DATABASE_URL
    // beats the worktree's own file.
    runWhileBranchWakes(worktreeValue.migrateCommand, {
      cwd: path,
      env: { ...process.env, DATABASE_URL: database.databaseUrl },
    });
    console.log(`\nWorktree ready on ${branch}:\n  cd ${path}`);
    console.log(
      `  database: ${database.name} (expires in ${String(cappedExpiryDays(options.days))} days)`,
    );
    return;
  }

  console.log(`\nWorktree ready on ${branch}:\n  cd ${path}`);
}

export function parseDays(args: string[]): number {
  const index = args.indexOf("--days");
  if (index === -1) {
    return worktreeValue.defaultExpiryDays;
  }
  const days = Number(args[index + 1]);
  return Number.isFinite(days) ? days : worktreeValue.defaultExpiryDays;
}

type WorktreeArgs = { branch?: string; database: boolean; days: number };

export function parseArgs(argv: string[]): WorktreeArgs {
  const args = argv.slice(2);
  const daysIndex = args.indexOf("--days");
  const daysValueIndex = daysIndex === -1 ? -1 : daysIndex + 1;
  const positional = args.filter((arg, index) => !arg.startsWith("--") && index !== daysValueIndex);

  return {
    branch: positional[0],
    database: !args.includes("--no-db"),
    days: parseDays(args),
  };
}

function main(): void {
  const { branch, database, days } = parseArgs(process.argv);

  if (!branch) {
    console.error("Usage: vp run wt <branch> [--no-db] [--days <n>]");
    process.exit(1);
  }

  createWorktree(branch, { database, days });
}

// Importable for tests: only run when invoked directly.
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  main();
}
