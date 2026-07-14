// Constrained string values shared by the entity Zod schemas. Mirrors
// packages/db/src/constants.ts; kept as a separate domain-owned copy so `packages/domain`
// has no dependency on `packages/db` (per AGENTS.md layering).

/** External identity sources (ADR 0005). Dribl is the only source today. */
export const sourceValue = {
  dribl: "dribl",
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
