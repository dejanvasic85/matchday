// The Coastal generator's entry point: everything one season looks like at a given moment — its
// fixtures and its ladder. The adapter crawls through this, and the parse keeps a bad shape out.

import { generateSeasonFixtures } from "#crawlers/coastal/fixtureGenerator.ts";
import { buildLadder } from "#crawlers/coastal/ladder.ts";
import {
  coastalSeasonGenerationSchema,
  type CoastalSeason,
  type CoastalSeasonGeneration,
} from "#crawlers/coastal/schemas.ts";

/** The season's fixtures and ladder as they stand at `now`. */
export function generateCoastalSeason(season: CoastalSeason, now: Date): CoastalSeasonGeneration {
  const fixtures = generateSeasonFixtures(season, now);
  return coastalSeasonGenerationSchema.parse({ season, fixtures, ladder: buildLadder(fixtures) });
}
