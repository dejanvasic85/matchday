// How long a bounded retry waits between attempts, and the waiting itself. Shared so the
// data-access retry and the crawler's fetch retry dither the same way.

export type BackoffConfig = {
  /** Wait before the second attempt; doubles each attempt after that. */
  baseDelayMs: number;
  /** Ceiling on the doubling, before jitter. */
  maxDelayMs: number;
};

/**
 * Exponential backoff with equal jitter: half the window fixed, half random. The league crawl
 * fans out to one job per league, so a shared blip fails them together — undithered retries
 * would then all come back at the same instant and blip again.
 */
export function backoffDelayMs(attempt: number, config: BackoffConfig): number {
  const window = Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** (attempt - 1));
  return window / 2 + Math.random() * (window / 2);
}

/** Wait `ms`, so a retry loop's pause is one call rather than a hand-rolled Promise each time. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
