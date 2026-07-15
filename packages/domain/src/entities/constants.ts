// Constrained string values shared by the entity Zod schemas. Mirrors
// packages/db/src/constants.ts; kept as a separate domain-owned copy so `packages/domain`
// has no dependency on `packages/db` (per AGENTS.md layering).

/**
 * External identity sources (ADR 0005, 0012). `dribl` = a Dribl entity's own hashed id (clubs from
 * clubs-sync, teams via `team_hash_id`). `driblClubCode` = a club's `club_code`, the stable club
 * key the crawl path exposes on ladder rows (the only club identifier ladders/fixtures carry).
 */
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

/** Entity type tags for the polymorphic `external_ref` mapping. */
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
