// Health service: decides overall readiness from a DB ping. Pure business logic — receives
// `pingDb` (already bound to a db client by the caller, per subscriptionService.ts's pattern) by
// argument so tests pass a fake instead of a real Db (AGENTS.md).

import { err, ok, type Result } from "@matchday/domain";
import type { pingDb } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type HealthStatus = { status: "ok" };

export type CheckHealthDeps = {
  pingDb: WithoutDb<typeof pingDb>;
};

export async function checkHealth(deps: CheckHealthDeps): Promise<Result<HealthStatus>> {
  const pingResult = await deps.pingDb();
  if (!pingResult.ok) {
    return err({ message: "Database unreachable", cause: pingResult.error.cause });
  }
  return ok({ status: "ok" });
}
