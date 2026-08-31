import { parseEnv } from "@matchday/domain";
import { z } from "zod";

/**
 * Scheduler environment. On Cloudflare Workers there is no `process.env`; the runtime passes an
 * `env` binding into the scheduled handler. Vars are documented in `apps/scheduler/.env.example`.
 */
const schedulerEnvSchema = z.object({
  // Fine-grained PAT with Actions: read and write on this repo only. A Worker secret, never a var.
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_OWNER: z.string().min(1),
  GITHUB_REPO: z.string().min(1),
  // Branch the workflows are dispatched from. GitHub only accepts refs it holds the workflow on.
  GITHUB_REF: z.string().min(1).default("main"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
});

export type SchedulerConfig = z.infer<typeof schedulerEnvSchema>;

/** Raw Cloudflare Workers bindings (vars + secrets) as handed to the scheduled handler, before
 * Zod validation. */
export type SchedulerBindings = Record<string, string | undefined>;

export function getSchedulerConfig(source: SchedulerBindings): SchedulerConfig {
  return parseEnv(schedulerEnvSchema, source);
}
