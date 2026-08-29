// Season resolution: "which season does this command act on?" in one place. There is no
// `is_current` flag on `season` — a season's name is the year the source gave us, so the current
// one is simply the latest row, and `--season <year>` overrides it.

import { notFound, ok, parseId, serverError, type Result, type SeasonId } from "@matchday/domain";
import type { findLatestSeason, findSeasonByName } from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type SeasonResolverDeps = {
  findLatestSeason: WithoutDb<typeof findLatestSeason>;
  findSeasonByName: WithoutDb<typeof findSeasonByName>;
};

export type ResolvedSeason = {
  id: SeasonId;
  name: string;
};

function toSeasonId(id: string): Result<SeasonId> {
  const seasonId = parseId(id, "season");
  if (seasonId === undefined) {
    return serverError(`Season row id "${id}" doesn't have the expected "sea_" prefix`);
  }
  return ok(seasonId);
}

/**
 * Resolve the season a command targets: the named one when `name` is given, otherwise the latest
 * season we hold. An unknown name fails rather than falling back to the latest — a typo'd
 * `--season 20227` must not quietly act on the current season instead.
 *
 * A season only exists once the catalog crawl has created it, so next year's rollover needs that
 * crawl to have run first. That ordering is deliberate: there are no leagues to subscribe to
 * before it has.
 */
export async function resolveSeason(
  deps: SeasonResolverDeps,
  name?: string,
): Promise<Result<ResolvedSeason>> {
  const found =
    name === undefined ? await deps.findLatestSeason() : await deps.findSeasonByName(name);
  if (!found.ok) {
    return found;
  }

  if (found.value === null) {
    return name === undefined
      ? notFound("No seasons exist yet — run `mday catalog` before subscribing anyone")
      : notFound(`No season named "${name}" — run \`mday catalog --season ${name}\` first`);
  }

  const idResult = toSeasonId(found.value.id);
  if (!idResult.ok) {
    return idResult;
  }
  return ok({ id: idResult.value, name: found.value.name });
}
