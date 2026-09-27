// `external_ref` source ids for Coastal. The unique index is on `(source, source_id)` alone, so
// every entity type is namespaced — club and team share a roster key, and season and league share
// a season name, so neither pair may collide.

import { coastalValue } from "#crawlers/coastal/constants.ts";
import type { CoastalClub } from "#crawlers/coastal/roster.ts";
import type { CoastalFixture, CoastalSeason } from "#crawlers/coastal/schemas.ts";

const seasonPrefix = "season-";
const leaguePrefix = "league-";
const clubPrefix = "club-";
const teamPrefix = "team-";
const fixturePrefix = "fixture-";

export const coastalCompetitionSourceId = coastalValue.competitionSourceId;

export function coastalSeasonSourceId(season: CoastalSeason): string {
  return `${seasonPrefix}${season.name}`;
}

export function coastalLeagueSourceId(season: CoastalSeason): string {
  return `${leaguePrefix}${season.name}`;
}

export function coastalClubSourceId(club: CoastalClub): string {
  return `${clubPrefix}${club.key}`;
}

export function coastalTeamSourceId(club: CoastalClub): string {
  return `${teamPrefix}${club.key}`;
}

export function coastalFixtureSourceId(fixture: CoastalFixture): string {
  return `${fixturePrefix}${fixture.key}`;
}

/** The season name inside a season or league source id, or undefined when it is neither. */
export function coastalSeasonNameFromSourceId(sourceId: string): string | undefined {
  for (const prefix of [seasonPrefix, leaguePrefix]) {
    if (sourceId.startsWith(prefix)) {
      return sourceId.slice(prefix.length);
    }
  }
  return undefined;
}
