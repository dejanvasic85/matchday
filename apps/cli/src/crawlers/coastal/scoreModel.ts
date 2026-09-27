// The Coastal score model: a Poisson draw per side, tilted by the two clubs' strength ratings and a
// small home advantage. A Poisson draw makes draws and 0–0 results appear naturally rather than
// forcing a winner, which is what makes the generated ladder read as real.

import type { SeededRandom } from "#crawlers/coastal/random.ts";
import { scoreModelValue } from "#crawlers/coastal/constants.ts";

export type CoastalScore = {
  home: number;
  away: number;
};

/** A Poisson draw by Knuth's method: count uniforms until their product drops below `e^-lambda`. */
export function poissonDraw(random: SeededRandom, lambda: number): number {
  const limit = Math.exp(-lambda);
  let goals = 0;
  let product = 1;
  do {
    goals += 1;
    product *= random();
  } while (product > limit);
  return Math.min(goals - 1, scoreModelValue.maxGoals);
}

/** Each side's expected goals: league average scaled by the strength ratio, with the home side
 * lifted by the home advantage. */
export function expectedGoals(homeStrength: number, awayStrength: number): CoastalScore {
  const strengthRatio = homeStrength / awayStrength;
  return {
    home: scoreModelValue.baseGoalsPerTeam * strengthRatio * scoreModelValue.homeAdvantage,
    away: scoreModelValue.baseGoalsPerTeam / strengthRatio,
  };
}

/** A final score for a match, drawn from the seeded `random`. */
export function drawScore(
  homeStrength: number,
  awayStrength: number,
  random: SeededRandom,
): CoastalScore {
  const expected = expectedGoals(homeStrength, awayStrength);
  return {
    home: poissonDraw(random, expected.home),
    away: poissonDraw(random, expected.away),
  };
}
