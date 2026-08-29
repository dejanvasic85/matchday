import { customAlphabet } from "nanoid";

/**
 * Entity ID prefixes. Each entity's primary key is an
 * app-owned prefixed nanoid, e.g. `clb_V1StGXR8Z5`.
 */
export const idPrefixValue = {
  club: "clb",
  team: "tea",
  competition: "cmp",
  season: "sea",
  league: "lea",
  fixture: "mtc",
  tableEntry: "tab",
  leagueTeam: "lgt",
  externalRef: "ext",
  subscription: "sub",
  client: "cli",
  clientClub: "ccl",
  apiToken: "tok",
} as const;

export type EntityType = keyof typeof idPrefixValue;
export type IdPrefix = (typeof idPrefixValue)[EntityType];

/**
 * A branded entity ID. Modelled as a template-literal type on the entity's prefix so a
 * matching string is directly assignable — no unsafe cast needed to produce one.
 */
export type EntityId<T extends EntityType> = `${(typeof idPrefixValue)[T]}_${string}`;

export type ClubId = EntityId<"club">;
export type TeamId = EntityId<"team">;
export type CompetitionId = EntityId<"competition">;
export type SeasonId = EntityId<"season">;
export type LeagueId = EntityId<"league">;
export type FixtureId = EntityId<"fixture">;
export type TableEntryId = EntityId<"tableEntry">;
export type LeagueTeamId = EntityId<"leagueTeam">;
export type ExternalRefId = EntityId<"externalRef">;
export type SubscriptionId = EntityId<"subscription">;
export type ClientId = EntityId<"client">;
export type ClientClubId = EntityId<"clientClub">;
export type ApiTokenId = EntityId<"apiToken">;

const nanoidAlphabetValue = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoidLengthValue = 12;

const generateNanoid = customAlphabet(nanoidAlphabetValue, nanoidLengthValue);

/** Generate a new prefixed-nanoid primary key for the given entity type. */
export function generateId<T extends EntityType>(entityType: T): EntityId<T> {
  return `${idPrefixValue[entityType]}_${generateNanoid()}`;
}

/** True if `value` has the expected prefix for `entityType`. */
export function isIdOfType<T extends EntityType>(
  value: string,
  entityType: T,
): value is EntityId<T> {
  return value.startsWith(`${idPrefixValue[entityType]}_`);
}

/** Parse and brand `value` as an `EntityId<T>`, or return `undefined` if the prefix doesn't match. */
export function parseId<T extends EntityType>(
  value: string,
  entityType: T,
): EntityId<T> | undefined {
  return isIdOfType(value, entityType) ? value : undefined;
}
