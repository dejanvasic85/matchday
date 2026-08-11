import type { FetchPage } from "#crawlers/dribl/browserFetch.ts";

/** A `FetchPage` fake that returns a queued response per call, in order. */
export function makeQueuedFakePage(responses: unknown[]): FetchPage {
  const queue = [...responses];
  return {
    evaluate: () => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error("No more fake responses queued");
      }
      return Promise.resolve(JSON.stringify(next));
    },
  };
}
