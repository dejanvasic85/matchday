// Constrained string values for the schema: stored as `text` and validated at the Zod
// boundary rather than as DB enums, so values can evolve without a migration.

/** External identity sources. */
export const sourceValue = {
  dribl: "dribl",
  driblClubCode: "dribl_club_code",
} as const;

export type Source = (typeof sourceValue)[keyof typeof sourceValue];

/** Fixture lifecycle states. */
export const fixtureStatusValue = {
  scheduled: "scheduled",
  inProgress: "in_progress",
  completed: "completed",
  postponed: "postponed",
  cancelled: "cancelled",
} as const;

export type FixtureStatus = (typeof fixtureStatusValue)[keyof typeof fixtureStatusValue];

/** Entity type tags for the polymorphic `external_ref` mapping; mirrors the prefixed-nanoid ID types. */
export const externalRefEntityTypeValue = {
  club: "club",
  team: "team",
  competition: "competition",
  season: "season",
  league: "league",
  fixture: "fixture",
} as const;

export type ExternalRefEntityType =
  (typeof externalRefEntityTypeValue)[keyof typeof externalRefEntityTypeValue];

/** Bounded retry for transient neon-http failures (see runQuery). Attempts include the first try;
 * backoff is `baseDelayMs * 2 ** (attempt - 1)`, so 3 attempts wait ~100ms then ~200ms. */
export const retryConfigValue = {
  maxAttempts: 3,
  baseDelayMs: 100,
} as const;
