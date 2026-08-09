// Health service: decides overall readiness from a DB ping. Pure business logic — receives
// `pingDb` by argument so tests pass a fake instead of a real Db (AGENTS.md).

import { err, ok, type Result } from "@matchday/domain";
import { pingDb, type Db } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type HealthStatus = { status: "ok" };

export type CheckHealthDeps = {
  pingDb: WithoutDb<typeof pingDb>;
};

/** Wires the real data-access function to a live `db` — the only place this route's transport
 * layer should reach into @matchday/db (AGENTS.md: routes are glue, services own the logic). */
export function createCheckHealthDeps(db: Db): CheckHealthDeps {
  return { pingDb: () => pingDb(db) };
}

export async function checkHealth(deps: CheckHealthDeps): Promise<Result<HealthStatus>> {
  const pingResult = await deps.pingDb();
  if (!pingResult.ok) {
    return err({ message: "Database unreachable", cause: pingResult.error.cause });
  }
  return ok({ status: "ok" });
}
