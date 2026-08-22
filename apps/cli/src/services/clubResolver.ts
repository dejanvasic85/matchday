// Club resolution (#85): resolve a club by a human-typed name fragment via fuzzy, case-insensitive
// partial match (unlike clientResolver's exact match). Ambiguous input fails listing candidates.

import {
  badRequest,
  notFound,
  ok,
  parseId,
  serverError,
  type ClubId,
  type Result,
} from "@matchday/domain";
import type { findClubsByName } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClubResolverDeps = {
  findClubsByName: WithoutDb<typeof findClubsByName>;
};

export type ResolvedClub = {
  id: ClubId;
  name: string;
};

function toClubId(id: string): Result<ClubId> {
  const clubId = parseId(id, "club");
  if (clubId === undefined) {
    return serverError(`Club row id "${id}" doesn't have the expected "clb_" prefix`);
  }
  return ok(clubId);
}

/** Resolve a club by a name fragment, failing on zero or multiple matches rather than guessing. */
export async function resolveClub(
  deps: ClubResolverDeps,
  name: string,
): Promise<Result<ResolvedClub>> {
  const found = await deps.findClubsByName(name);
  if (!found.ok) {
    return found;
  }

  if (found.value.length === 0) {
    return notFound(`No club matches "${name}"`);
  }

  if (found.value.length > 1) {
    const candidates = found.value.map((club) => `${club.name} (${club.id})`).join(", ");
    return badRequest(`"${name}" matches more than one club — candidates: ${candidates}`);
  }

  const [club] = found.value;
  const idResult = toClubId(club.id);
  if (!idResult.ok) {
    return idResult;
  }
  return ok({ id: idResult.value, name: club.name });
}
