// Client resolution (ADR 0013): resolve a client by name. Creation is deliberately its own
// explicit step (`mday client add`) — an implicit create would turn a name typo into a new tenant.

import {
  generateId,
  notFound,
  ok,
  parseId,
  serverError,
  type ClientId,
  type Result,
} from "@matchday/domain";
import type { findClientByName, upsertClientByName } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClientResolverDeps = {
  findClientByName: WithoutDb<typeof findClientByName>;
};

export type ClientCreatorDeps = {
  upsertClientByName: WithoutDb<typeof upsertClientByName>;
};

function toClientId(id: string): Result<ClientId> {
  const clientId = parseId(id, "client");
  if (clientId === undefined) {
    return serverError(`Client row id "${id}" doesn't have the expected "cli_" prefix`);
  }
  return ok(clientId);
}

/** Find an existing client by name, failing with `notFound` when there is none. */
export async function resolveClient(
  deps: ClientResolverDeps,
  name: string,
): Promise<Result<ClientId>> {
  const found = await deps.findClientByName(name);
  if (!found.ok) {
    return found;
  }
  if (found.value === null) {
    return notFound(`Client not found: ${name}. Create it first with "mday client add".`);
  }
  return toClientId(found.value.id);
}

/** Create a client, or return the existing one's id when the name is already taken — `client add`
 * is idempotent so re-running it is never an error. */
export async function createClient(
  deps: ClientCreatorDeps,
  name: string,
): Promise<Result<ClientId>> {
  const id = generateId("client");
  const upserted = await deps.upsertClientByName({ id, name });
  if (!upserted.ok) {
    return upserted;
  }
  return toClientId(upserted.value.id);
}
