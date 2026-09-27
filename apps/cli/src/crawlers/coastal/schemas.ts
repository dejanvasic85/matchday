// The generator's output shapes. Kept as Zod schemas so the adapter that persists them validates at
// its boundary, and so these types stay the single source of truth for what the generator emits.

import { z } from "zod";
import { fixtureStatusValue, isoDateSchema } from "@matchday/domain";

/** A season's generated calendar window. `name` reads like "2026 Spring". */
export const coastalSeasonSchema = z.object({
  name: z.string(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema,
});

export type CoastalSeason = z.infer<typeof coastalSeasonSchema>;

/** One generated fixture. Sides are club keys from the roster, not DB ids — the adapter resolves
 * them. `key` is stable within the source across re-runs, so it is the fixture's external ref. */
export const coastalFixtureSchema = z.object({
  key: z.string(),
  round: z.number().int().positive(),
  homeClubKey: z.string(),
  awayClubKey: z.string(),
  kickoffAt: z.date(),
  venue: z.string(),
  status: z.enum(fixtureStatusValue),
  homeScore: z.number().int().nonnegative().nullable(),
  awayScore: z.number().int().nonnegative().nullable(),
});

export type CoastalFixture = z.infer<typeof coastalFixtureSchema>;

/** A ladder row, already ordered: `position` is the row's index in the sorted table. */
export const coastalLadderRowSchema = z.object({
  clubKey: z.string(),
  position: z.number().int().positive(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  goalsFor: z.number().int().nonnegative(),
  goalsAgainst: z.number().int().nonnegative(),
  goalDifference: z.number().int(),
  points: z.number().int().nonnegative(),
});

export type CoastalLadderRow = z.infer<typeof coastalLadderRowSchema>;

/** Everything the catalog and league crawls need for one season at one point in time. */
export const coastalSeasonGenerationSchema = z.object({
  season: coastalSeasonSchema,
  fixtures: z.array(coastalFixtureSchema),
  ladder: z.array(coastalLadderRowSchema),
});

export type CoastalSeasonGeneration = z.infer<typeof coastalSeasonGenerationSchema>;
