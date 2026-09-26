import type { LeagueWithRefs } from "@matchday/db";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

/** A `LeagueWithRefs` row — what `listLeaguesByClubId` returns, with the joined competition and
 * season nested. Use this rather than a flattened `{ id, name }` fake: the club→league service
 * lifts `season.endsOn` off the nested season, so a flat fake hides that mapping. */
export function makeLeagueWithRefs(overrides: Partial<LeagueWithRefs> = {}): LeagueWithRefs {
  const now = new Date("2026-01-01T00:00:00Z");
  const seasonId = overrides.seasonId ?? "sea_2026000000";
  return {
    id: "lea_abc123",
    name: "Div 1 North",
    competitionId: "cmp_abc123",
    seasonId,
    hasTable: true,
    createdAt: now,
    updatedAt: now,
    competition: {
      id: "cmp_abc123",
      name: "Senol NPL Victoria Men",
      createdAt: now,
      updatedAt: now,
    },
    season: {
      id: seasonId,
      name: "2026",
      startsOn: makeIsoDate("2026-02-12"),
      endsOn: makeIsoDate("2026-09-20"),
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}
