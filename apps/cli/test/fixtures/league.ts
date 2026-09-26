import type { LeagueWithRefs } from "@matchday/db";
import { makeIsoDate } from "#test/fixtures/calendarDate.ts";

type CompetitionSeason = NonNullable<LeagueWithRefs["competitionSeason"]>;

/** A competition-season row. Separate from {@link makeLeagueWithRefs} so a test can override the
 * window on a league without reaching through a nullable join result. */
export function makeCompetitionSeason(
  overrides: Partial<CompetitionSeason> = {},
): CompetitionSeason {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "cse_abc123",
    competitionId: "cmp_abc123",
    seasonId: "sea_2026000000",
    startsOn: makeIsoDate("2026-02-12"),
    endsOn: makeIsoDate("2026-09-20"),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** A `LeagueWithRefs` row — what `listLeaguesByClubId` returns, with the joined competition,
 * season and competition-season nested. Use this rather than a flattened `{ id, name }` fake: the
 * club→league service lifts `competitionSeason.endsOn` off the nested row, so a flat fake hides
 * that mapping. */
export function makeLeagueWithRefs(overrides: Partial<LeagueWithRefs> = {}): LeagueWithRefs {
  const now = new Date("2026-01-01T00:00:00Z");
  const seasonId = overrides.seasonId ?? "sea_2026000000";
  const competitionId = overrides.competitionId ?? "cmp_abc123";
  return {
    id: "lea_abc123",
    name: "Div 1 North",
    competitionId,
    seasonId,
    hasTable: true,
    createdAt: now,
    updatedAt: now,
    competition: {
      id: competitionId,
      name: "Senol NPL Victoria Men",
      createdAt: now,
      updatedAt: now,
    },
    season: {
      id: seasonId,
      source: "dribl",
      name: "2026",
      startsOn: null,
      endsOn: null,
      createdAt: now,
      updatedAt: now,
    },
    competitionSeason: makeCompetitionSeason({ competitionId, seasonId }),
    ...overrides,
  };
}
