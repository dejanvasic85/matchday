import { backoffDelayMs } from "#retryBackoff.ts";

const config = { baseDelayMs: 500, maxDelayMs: 8000 };

describe("backoffDelayMs", () => {
  // `clearMocks` clears calls but leaves a spy's implementation in place, and a stubbed
  // `Math.random` would then decide the next test's jitter too.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("doubles the wait window on each attempt", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);

    expect(backoffDelayMs(1, config)).toBe(500);
    expect(backoffDelayMs(2, config)).toBe(1000);
    expect(backoffDelayMs(3, config)).toBe(2000);
  });

  it("caps the window at maxDelayMs however many attempts have passed", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);

    expect(backoffDelayMs(10, config)).toBe(config.maxDelayMs);
  });

  it("never waits less than half the window, so a retry is always spaced out", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(backoffDelayMs(1, config)).toBe(250);
    expect(backoffDelayMs(3, config)).toBe(1000);
  });

  it("spreads callers across the window rather than releasing them together", () => {
    const window = 1000;
    const delays = new Set<number>();

    for (let caller = 0; caller < 50; caller += 1) {
      const waited = backoffDelayMs(2, config);
      expect(waited).toBeGreaterThanOrEqual(window / 2);
      expect(waited).toBeLessThanOrEqual(window);
      delays.add(waited);
    }

    // Undithered, 50 callers would all wait the identical amount and retry in lockstep.
    expect(delays.size).toBeGreaterThan(1);
  });
});
