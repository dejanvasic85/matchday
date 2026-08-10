// Client resolution (ADR 0013): resolve a client by name, creating it on first sight. Business
// logic lives here (AGENTS.md) so it's unit-testable with fakes.

import { generateId, ok, parseId, serverError, type ClientId, type Result } from "@matchday/domain";
import type { upsertClientByName } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClientResolverDeps = {
  upsertClientByName: WithoutDb<typeof upsertClientByName>;
};

function toClientId(id: string): Result<ClientId> {
  const clientId = parseId(id, "client");
  if (clientId === undefined) {
    return serverError(`Client row id "${id}" doesn't have the expected "cli_" prefix`);
  }
  return ok(clientId);
}

export async function resolveClient(
  deps: ClientResolverDeps,
  name: string,
): Promise<Result<ClientId>> {
  const id = generateId("client");
  const upserted = await deps.upsertClientByName({ id, name });
  if (!upserted.ok) {
    return upserted;
  }
  return toClientId(upserted.value.id);
}
