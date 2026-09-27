// Generates a Coastal season's fixtures for a given moment. Pairings, kickoff times and event
// states come from the season and match identity, and scores come from a seeded draw, so asking for
// the same season at the same time twice produces identical rows. Persisting something is the
// adapter's job; this module only decides what the world looks like.

import { fixtureStatusValue } from "@matchday/domain";
import { fixtureStateAt } from "#crawlers/coastal/fixtureState.ts";
import { kickoffInstant, matchesPerRound } from "#crawlers/coastal/kickoffSchedule.ts";
import {
  drawMatchEvent,
  matchEventValue,
  rescheduleKickoff,
} from "#crawlers/coastal/matchEvent.ts";
import { createSeededRandom, hashSeed } from "#crawlers/coastal/random.ts";
import { coastalClubs, type CoastalClub } from "#crawlers/coastal/roster.ts";
import { seasonRounds } from "#crawlers/coastal/roundRobin.ts";
import { seasonKey } from "#crawlers/coastal/seasonCalendar.ts";
import {
  coastalFixtureSchema,
  type CoastalFixture,
  type CoastalSeason,
} from "#crawlers/coastal/schemas.ts";

function clubAt(index: number): CoastalClub {
  const club = coastalClubs[index];
  if (club === undefined) {
    throw new Error(`Roster has no club at index ${index}`);
  }
  return club;
}

function buildFixture(
  season: CoastalSeason,
  round: number,
  matchIndex: number,
  home: CoastalClub,
  away: CoastalClub,
  now: Date,
): CoastalFixture {
  const eventSeed = hashSeed(season.name, round, matchIndex);
  const event = drawMatchEvent(createSeededRandom(eventSeed));
  const scheduledKickoff = kickoffInstant(season, round, matchIndex);

  const base = {
    key: `${seasonKey(season)}-r${round}-m${matchIndex}`,
    round,
    homeClubKey: home.key,
    awayClubKey: away.key,
    venue: home.ground,
  };

  if (event === matchEventValue.cancelled) {
    return coastalFixtureSchema.parse({
      ...base,
      kickoffAt: scheduledKickoff,
      status: fixtureStatusValue.cancelled,
      homeScore: null,
      awayScore: null,
    });
  }
  if (event === matchEventValue.postponed) {
    return coastalFixtureSchema.parse({
      ...base,
      kickoffAt: scheduledKickoff,
      status: fixtureStatusValue.postponed,
      homeScore: null,
      awayScore: null,
    });
  }

  const kickoffAt =
    event === matchEventValue.rescheduled
      ? rescheduleKickoff(scheduledKickoff, createSeededRandom(hashSeed(eventSeed, "reschedule")))
      : scheduledKickoff;

  const state = fixtureStateAt(
    kickoffAt,
    now,
    home.strength,
    away.strength,
    hashSeed(eventSeed, "score"),
  );

  return coastalFixtureSchema.parse({ ...base, kickoffAt, ...state });
}

/** Every fixture in a season, as it stands at `now`. */
export function generateSeasonFixtures(season: CoastalSeason, now: Date): CoastalFixture[] {
  const rounds = seasonRounds(coastalClubs.length);
  const fixtures: CoastalFixture[] = [];

  rounds.forEach((pairings, roundIndex) => {
    if (pairings.length !== matchesPerRound) {
      throw new Error(
        `Round ${roundIndex + 1} has ${pairings.length} pairings but ${matchesPerRound} kickoff slots`,
      );
    }
    pairings.forEach((pairing, matchIndex) => {
      const home = clubAt(pairing.homeIndex);
      const away = clubAt(pairing.awayIndex);
      fixtures.push(buildFixture(season, roundIndex + 1, matchIndex, home, away, now));
    });
  });

  return fixtures;
}
