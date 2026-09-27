import { scoreModelValue } from "#crawlers/coastal/constants.ts";
import { createSeededRandom, hashSeed } from "#crawlers/coastal/random.ts";
import { drawScore, expectedGoals, poissonDraw } from "#crawlers/coastal/scoreModel.ts";

const constantRandom = (value: number) => () => value;

describe("poissonDraw", () => {
  it("counts no events when the first uniform is already below the limit", () => {
    expect(poissonDraw(constantRandom(0.1), 1)).toBe(0);
  });

  it("caps a runaway draw at the configured maximum", () => {
    expect(poissonDraw(constantRandom(0.9), 1)).toBe(scoreModelValue.maxGoals);
  });

  it("does not draw fewer goals as the expected rate rises", () => {
    const uniforms = Array.from({ length: 20 }, (_, index) => createSeededRandom(index + 1));
    for (const random of uniforms) {
      const low = poissonDraw(random, 0.8);
      const high = poissonDraw(createSeededRandom(hashSeed("high")), 2.4);
      expect(high).toBeGreaterThanOrEqual(low);
    }
  });
});

describe("expectedGoals", () => {
  it("gives the home side the advantage when strengths are equal", () => {
    const expected = expectedGoals(1, 1);
    expect(expected.home).toBeGreaterThan(expected.away);
    expect(expected.away).toBeCloseTo(scoreModelValue.baseGoalsPerTeam);
  });

  it("lifts the stronger side and lowers the weaker", () => {
    expect(expectedGoals(1.2, 0.8).home).toBeGreaterThan(expectedGoals(0.8, 1.2).home);
    expect(expectedGoals(1.2, 0.8).away).toBeLessThan(expectedGoals(0.8, 1.2).away);
  });
});

describe("drawScore", () => {
  it("is deterministic for a seed", () => {
    const seed = hashSeed("2026 Spring", 1, 0, "score");
    expect(drawScore(1.2, 0.8, createSeededRandom(seed))).toEqual(
      drawScore(1.2, 0.8, createSeededRandom(seed)),
    );
  });

  it("draws whole, non-negative, bounded goals", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const score = drawScore(1, 1, createSeededRandom(seed));
      for (const goals of [score.home, score.away]) {
        expect(Number.isInteger(goals)).toBe(true);
        expect(goals).toBeGreaterThanOrEqual(0);
        expect(goals).toBeLessThanOrEqual(scoreModelValue.maxGoals);
      }
    }
  });

  it("naturally produces draws, including the occasional 0-0", () => {
    const scores = Array.from({ length: 300 }, (_, seed) =>
      drawScore(1, 1, createSeededRandom(seed)),
    );
    expect(scores.some((score) => score.home === score.away)).toBe(true);
    expect(scores.some((score) => score.home === 0 && score.away === 0)).toBe(true);
  });
});
