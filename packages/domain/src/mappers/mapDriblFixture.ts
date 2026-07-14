// Dribl-raw -> domain mapper (0004: explicit named transform at the crawl boundary).
//
// A raw fixture only carries team/league/competition/season *names* and Dribl hash IDs, not
// matchday's real entity IDs — resolving those requires DB lookups (upserting/looking up club,
// team, competition, season and league rows), which is a service concern, not a pure mapper.
// This produces an intermediate shape carrying everything a resolution service needs.

import { fixtureStatusValue, type FixtureStatus } from "../entities/constants.ts";
import type { DriblFixture } from "../external/driblFixture.ts";

export type MappedFixture = {
  sourceId: string;
  round: number | null;
  competitionName: string;
  leagueName: string;
  homeTeamName: string | null;
  homeTeamSourceId: string | null;
  awayTeamName: string | null;
  awayTeamSourceId: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  kickoffAt: Date | null;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  isBye: boolean;
};

const driblStatusToFixtureStatus: Record<string, FixtureStatus> = {
  pending: fixtureStatusValue.scheduled,
  scheduled: fixtureStatusValue.scheduled,
  in_progress: fixtureStatusValue.inProgress,
  live: fixtureStatusValue.inProgress,
  complete: fixtureStatusValue.completed,
  completed: fixtureStatusValue.completed,
  postponed: fixtureStatusValue.postponed,
  cancelled: fixtureStatusValue.cancelled,
  forfeit: fixtureStatusValue.cancelled,
};

function mapStatus(status: string): FixtureStatus {
  return driblStatusToFixtureStatus[status] ?? fixtureStatusValue.scheduled;
}

function parseRound(round: string): number | null {
  const parsed = Number.parseInt(round.replace(/^R/, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseKickoffAt(date: string): Date | null {
  // Results payloads omit a timezone indicator (e.g. "2026-04-26 03:15:00") but the value is
  // UTC; normalise to ISO 8601 with Z so it always parses as UTC.
  const normalised = date.replace(" ", "T").replace(/Z?$/, "Z");
  const parsed = new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatVenue(groundName: string | null, fieldName: string | null): string | null {
  if (groundName === null) {
    return null;
  }
  return fieldName !== null ? `${groundName} ${fieldName}` : groundName;
}

export function mapDriblFixture(fixture: DriblFixture): MappedFixture {
  const { attributes } = fixture;

  return {
    sourceId: fixture.hash_id,
    round: parseRound(attributes.round),
    competitionName: attributes.competition_name,
    leagueName: attributes.league_name,
    homeTeamName: attributes.home_team_name,
    homeTeamSourceId: attributes.home_team_hash_id,
    awayTeamName: attributes.away_team_name,
    awayTeamSourceId: attributes.away_team_hash_id,
    venue: formatVenue(attributes.ground_name, attributes.field_name),
    latitude: attributes.ground_latitude,
    longitude: attributes.ground_longitude,
    kickoffAt: parseKickoffAt(attributes.date),
    status: mapStatus(attributes.status),
    homeScore: attributes.home_score,
    awayScore: attributes.away_score,
    isBye: attributes.bye_flag,
  };
}
