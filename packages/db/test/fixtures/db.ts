// Shared fixture factories for db tests. `makeXRow` builds a snake_case DB-row shape (as
// returned by Drizzle selects) for use in data-access fakes.

import { schema, sourceValue } from "@matchday/db";

type ClubRow = typeof schema.club.$inferSelect;
type ExternalRefRow = typeof schema.externalRef.$inferSelect;

const epoch = new Date("2026-01-01T00:00:00.000Z");

export function makeClubRow(overrides: Partial<ClubRow> = {}): ClubRow {
  return {
    id: "clb_test000000",
    name: "Test FC",
    displayName: "Test FC",
    logoUrl: null,
    email: null,
    website: null,
    address: null,
    socials: null,
    grounds: null,
    color: null,
    accent: null,
    store: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

export function makeExternalRefRow(overrides: Partial<ExternalRefRow> = {}): ExternalRefRow {
  return {
    id: "ext_test000000",
    entityType: "club",
    internalId: "clb_test000000",
    source: sourceValue.dribl,
    sourceId: "dribl-hash-000",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}
