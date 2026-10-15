import { parseId, type EntityId, type EntityType } from "@matchday/domain";

/** A literal id for fixtures, validated so a wrong prefix fails loudly instead of producing a
 * branded value the type system trusts. Cast-free (AGENTS.md bans `as`). */
export function makeId<T extends EntityType>(value: string, entityType: T): EntityId<T> {
  const parsed = parseId(value, entityType);
  if (parsed === undefined) {
    throw new Error(`Fixture id "${value}" is not a ${entityType} id`);
  }
  return parsed;
}
