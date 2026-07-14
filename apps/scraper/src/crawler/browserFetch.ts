// Fetches a URL from inside an already-cleared browser page context, so Cloudflare's clearance
// cookies apply transparently (dribl-crawling skill). A raw `curl`/fetch outside the browser
// context gets HTTP 403.

import { err, ok, type Result } from "@matchday/domain";

/** The slice of playwright-core's `Page` this module depends on — narrow for easy faking in tests. */
export type FetchPage = {
  evaluate: (fn: (url: string) => Promise<string>, arg: string) => Promise<string>;
};

async function fetchInPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

export async function browserFetch(page: FetchPage, url: string): Promise<Result<unknown>> {
  try {
    const raw = await page.evaluate(fetchInPage, url);
    return ok(JSON.parse(raw));
  } catch (cause) {
    return err({ message: `Failed to fetch ${url}`, cause });
  }
}
