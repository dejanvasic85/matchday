import { execFileSync } from "node:child_process";
import { hostname, platform } from "node:os";

import { loadRootEnv } from "#scripts/env.ts";
import { isJsonObject } from "#scripts/json.ts";
import type { JsonValue } from "#scripts/json.ts";

export const neonBranchValue = {
  projectId: "soft-bread-13156032",
  databaseName: "matchday",
  parentBranch: "production",
  maxExpiryDays: 7,
  msPerDay: 86_400_000,
  // 10 attempts (27s of waiting) gave up too early on real branches; each woke a few
  // seconds after the last try.
  wakeAttempts: 20,
  wakeRetryMs: 3000,
} as const;

/** Shared branches and CI branches are never any one machine's to delete. */
const branchPolicyValue = {
  protectedNames: ["main", "production"],
  ciPrefix: "pr-",
} as const;

export function isProtectedBranch(name: string): boolean {
  return (
    branchPolicyValue.protectedNames.some((protectedName) => protectedName === name) ||
    name.startsWith(branchPolicyValue.ciPrefix)
  );
}

/** Matches a whole machine segment, so `unraid-2` is not `unraid`. */
export function isOwnBranchName(name: string, prefix: string): boolean {
  return name.startsWith(prefix);
}

/** Blocks the thread: these scripts have nothing else to do while they wait. */
function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function splitCommand(command: readonly string[]): [string, string[]] {
  const [binary, ...args] = command;
  if (binary === undefined) {
    throw new Error("A command requires a binary.");
  }

  return [binary, args];
}

/**
 * Retries until it works or the attempts run out, rethrowing the last failure.
 * The waiting is a parameter so the policy can be tested without sleeping.
 */
export function withRetries(run: () => void, wait: (attempt: number) => void, attempts: number) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      run();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      wait(attempt);
    }
  }
}

/** Says what it is waiting for, so a slow start does not look like a hang. */
function announceAndWait(attempt: number): void {
  console.log(
    `\nThe database is not accepting connections yet. Trying again in ${String(neonBranchValue.wakeRetryMs / 1000)}s (${String(attempt)}/${String(neonBranchValue.wakeAttempts)}).`,
  );
  sleep(neonBranchValue.wakeRetryMs);
}

/**
 * Runs a command against a branch that may still be starting. A branch just created or
 * reset has a compute coming up, and drizzle-kit connects over TCP, which is ready last.
 * drizzle-kit prints nothing when it fails, so without this it reads as broken rather
 * than impatient.
 */
export function runWhileBranchWakes(
  command: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): void {
  const [binary, args] = splitCommand(command);

  withRetries(
    () => {
      execFileSync(binary, args, { cwd: options.cwd, env: options.env, stdio: "inherit" });
    },
    announceAndWait,
    neonBranchValue.wakeAttempts,
  );
}

function neon(args: string[]): string {
  return execFileSync("neon", args, { encoding: "utf8" }).trim();
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The name the user gave this machine, which DHCP cannot change (unlike hostname()). */
function configuredMachineName(): string | undefined {
  const [command, args] =
    platform() === "darwin"
      ? (["scutil", ["--get", "ComputerName"]] as const)
      : (["hostnamectl", ["--static"]] as const);
  try {
    const name = execFileSync(command, [...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return name === "" ? undefined : name;
  } catch {
    return undefined;
  }
}

// Two machines on the same git branch must not share one database, so the name has to be
// stable: os.hostname() is not, since DHCP can rename the machine.
export function machineId(): string {
  loadRootEnv();
  const configured = process.env["MATCHDAY_MACHINE"] ?? configuredMachineName();
  const [host] = hostname().split(".");
  return slug(configured ?? host ?? hostname());
}

export function branchName(gitBranch: string): string {
  return `${machineId()}/${slug(gitBranch)}`;
}

/** Neon takes an absolute timestamp, not a duration. Capped so nothing outlives the cap. */
export function cappedExpiryDays(days: number): number {
  return Math.min(Math.max(days, 1), neonBranchValue.maxExpiryDays);
}

export function expiryTimestamp(days: number): string {
  return new Date(Date.now() + cappedExpiryDays(days) * neonBranchValue.msPerDay).toISOString();
}

function projectArgs(): string[] {
  return ["--project-id", neonBranchValue.projectId];
}

function branchExists(name: string): boolean {
  const branches = neon([...projectArgs(), "branches", "list", "--output", "json"]);
  const parsed: JsonValue = JSON.parse(branches);
  return (
    Array.isArray(parsed) &&
    parsed.some((branch) => isJsonObject(branch) && branch["name"] === name)
  );
}

function createBranch(name: string, expiresAt: string): void {
  neon([
    ...projectArgs(),
    "branches",
    "create",
    "--name",
    name,
    "--parent",
    neonBranchValue.parentBranch,
    "--expires-at",
    expiresAt,
  ]);
}

/** Reuse means a stale schema, so reset from the parent and push the expiry out again. */
function refreshBranch(name: string, expiresAt: string): void {
  neon([...projectArgs(), "branches", "reset", name, "--parent"]);
  neon([...projectArgs(), "branches", "set-expiration", name, "--expires-at", expiresAt]);
}

function connectionString(name: string): string {
  return neon([
    "connection-string",
    name,
    ...projectArgs(),
    "--database-name",
    neonBranchValue.databaseName,
    "--pooled",
  ]);
}

type BranchDetails = { name: string; databaseUrl: string };

/** Creates or refreshes the branch for a git branch, and returns its pooled URL. */
export function ensureBranch(gitBranch: string, days: number): BranchDetails {
  const name = branchName(gitBranch);
  const expiresAt = expiryTimestamp(days);

  if (branchExists(name)) {
    refreshBranch(name, expiresAt);
  } else {
    createBranch(name, expiresAt);
  }

  return { name, databaseUrl: connectionString(name) };
}
