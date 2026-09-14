// Fetches a URL from inside an already-cleared browser page so Cloudflare's clearance cookies
// apply; a raw `curl`/fetch outside the browser context gets HTTP 403.

import {
  backoffDelayMs,
  delay,
  describeCause,
  ok,
  serverError,
  type Result,
} from "@matchday/domain";
import { fetchRetryConfigValue, transientHttpStatusValue } from "#crawlers/dribl/constants.ts";

/** The slice of playwright-core's `Page` this module depends on — narrow for easy faking in tests. */
export type FetchPage = {
  evaluate: (fn: (url: string) => Promise<string>, arg: string) => Promise<string>;
};

// An Error thrown inside the page is rebuilt outside it from `name` and `message` alone, so the
// status survives only as text — and unanchored, because playwright prefixes the message.
const httpStatusPattern = /HTTP (\d{3}) fetching /;

async function fetchInPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

/**
 * A 5xx or 429 from Dribl is a blip; any other 4xx is a URL it will keep refusing, a lost
 * Cloudflare clearance included — that needs a fresh session, not another attempt. No status at
 * all means fetch or playwright threw: a dropped connection or timeout, which is what we mostly see.
 */
function isTransientFetchFailure(cause: unknown): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }
  const matched = httpStatusPattern.exec(cause.message);
  if (matched === null) {
    return true;
  }
  const status = Number(matched[1]);
  return (
    status >= transientHttpStatusValue.serverErrorFloor ||
    status === transientHttpStatusValue.tooManyRequests
  );
}

/** Fetch `url` in the page and parse it as JSON. Transient failures are retried up to
 * `maxAttempts` with jittered backoff; re-fetching is safe because every caller only reads. */
export async function browserFetch(page: FetchPage, url: string): Promise<Result<unknown>> {
  let lastCause: unknown;

  for (let attempt = 1; attempt <= fetchRetryConfigValue.maxAttempts; attempt += 1) {
    let raw: string;
    try {
      raw = await page.evaluate(fetchInPage, url);
    } catch (cause) {
      lastCause = cause;
      if (attempt >= fetchRetryConfigValue.maxAttempts || !isTransientFetchFailure(cause)) {
        break;
      }
      await delay(backoffDelayMs(attempt, fetchRetryConfigValue));
      continue;
    }
    // A body that isn't JSON is a Cloudflare challenge page or an API change, and asking again
    // returns the same thing.
    try {
      return ok(JSON.parse(raw));
    } catch (cause) {
      return serverError(`Failed to parse the response from ${url}`, describeCause(cause));
    }
  }

  return serverError(`Failed to fetch ${url}`, describeCause(lastCause));
}
