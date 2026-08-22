// Dribl-raw -> domain mapper (0004). Only names/hash IDs are available here, not matchday's real
// entity IDs; resolving those needs DB lookups, so this produces an intermediate shape for that.

import { fixtureStatusValue, type FixtureStatus } from "@matchday/domain";
import type { DriblFixture } from "#crawlers/dribl/external/driblFixture.ts";

export type MappedFixture = {
  sourceId: string;
  round: number | null;
  competitionName: string;
  leagueName: string;
  homeTeamName: string | null;
  homeTeamSourceId: string | null;
  homeTeamLogoUrl: string | null;
  awayTeamName: string | null;
  awayTeamSourceId: string | null;
  awayTeamLogoUrl: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  kickoffAt: Date | null;
  status: FixtureStatus;
  /** The raw Dribl status string, unmapped. `null` when it mapped to a known status cleanly;
   * set when `status` above is the `scheduled` fallback for an unrecognised raw value, so a
   * caller with a logger can flag the drift instead of it being silently miscategorised. */
  unmappedStatus: string | null;
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

function isUnmappedStatus(status: string): boolean {
  return !(status in driblStatusToFixtureStatus);
}

function parseRound(round: string): number | null {
  const parsed = Number.parseInt(round.replace(/^R/, ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const hasTimezoneMarker = /(Z|[+-]\d{2}:?\d{2})$/;

function parseKickoffAt(date: string): Date | null {
  // Results payloads omit a timezone marker but the value is UTC; append Z only when no marker
  // is already present, so an already-offset date isn't corrupted into "...+10:00Z".
  const isoDate = date.replace(" ", "T");
  const normalised = hasTimezoneMarker.test(isoDate) ? isoDate : `${isoDate}Z`;
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
    homeTeamLogoUrl: attributes.home_logo,
    awayTeamName: attributes.away_team_name,
    awayTeamSourceId: attributes.away_team_hash_id,
    awayTeamLogoUrl: attributes.away_logo,
    venue: formatVenue(attributes.ground_name, attributes.field_name),
    latitude: attributes.ground_latitude,
    longitude: attributes.ground_longitude,
    kickoffAt: parseKickoffAt(attributes.date),
    status: mapStatus(attributes.status),
    unmappedStatus: isUnmappedStatus(attributes.status) ? attributes.status : null,
    homeScore: attributes.home_score,
    awayScore: attributes.away_score,
    isBye: attributes.bye_flag,
  };
}
