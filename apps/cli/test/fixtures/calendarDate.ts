import type { IsoDate } from "@matchday/domain";
import { parseIsoDate } from "@matchday/domain";

/** A literal date for fixtures, validated so a typo fails loudly instead of producing a branded
 * value the type system trusts. Cast-free (AGENTS.md bans `as`). */
export function makeIsoDate(value: string): IsoDate {
  const parsed = parseIsoDate(value);
  if (parsed === undefined) {
    throw new Error(`Fixture date is not YYYY-MM-DD: ${value}`);
  }
  return parsed;
}
