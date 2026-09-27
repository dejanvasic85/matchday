// Deterministic randomness for the Coastal generator. Every draw is seeded from match identity, so
// re-running a crawl at the same time produces byte-identical rows — the generator never reads a
// global random source.

/** FNV-1a over the joined parts, kept to 32 bits so mulberry32 can seed from it. */
export function hashSeed(...parts: readonly (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join(":")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type SeededRandom = () => number;

/** mulberry32 — a small, fast PRNG with a 32-bit state, plenty for believable match outcomes. */
export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in the inclusive `[min, max]` range. */
export function randomInteger(random: SeededRandom, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
