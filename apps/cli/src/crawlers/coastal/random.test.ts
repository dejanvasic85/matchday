import { createSeededRandom, hashSeed, randomInteger } from "#crawlers/coastal/random.ts";

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed("2026 Spring", 1, 0)).toBe(hashSeed("2026 Spring", 1, 0));
  });

  it("changes when any part changes", () => {
    expect(hashSeed("2026 Spring", 1, 0)).not.toBe(hashSeed("2026 Spring", 1, 1));
    expect(hashSeed("2026 Spring", 1)).not.toBe(hashSeed("2027 Summer", 1));
  });

  it("returns an unsigned 32-bit integer", () => {
    const seed = hashSeed("anything");
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});

describe("createSeededRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const firstValues = [first(), first(), first()];
    expect(firstValues).toEqual([second(), second(), second()]);
  });

  it("stays within [0, 1)", () => {
    const random = createSeededRandom(7);
    for (let index = 0; index < 100; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("randomInteger", () => {
  it("draws within the inclusive range", () => {
    const random = createSeededRandom(99);
    for (let index = 0; index < 100; index += 1) {
      const value = randomInteger(random, 1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(3);
    }
  });
});
