---
name: dribl-crawling
description: Reliable patterns for crawling dribl.com fixtures using playwright-core to establish Cloudflare clearance, then making direct mc-api.dribl.com API calls (via page.evaluate(fetch(...))) instead of driving the SPA. Covers hashed-ID resolution, round-based extraction, table extraction, and boundary validation.
---

# Dribl Crawling

## Overview

Extract clubs, fixtures, and tables from Dribl (a Cloudflare-protected SPA, e.g.
`https://<tenant>.dribl.com/fixtures/`) by using a real browser **only** to obtain Cloudflare
clearance, then making direct calls to the `mc-api.dribl.com` JSON API from within the browser
context. This teaches the durable crawl technique; where and how the results are persisted is
deliberately left to the consumer.

## Why direct API — not SPA scraping

- The SPA's default date-window views (Results + upcoming Fixtures) create a **dead zone of 4+
  rounds** whenever a team is regraded to a new league mid-season. The Dribl API accepts a `round`
  param; iterating `round=1..N` is deterministic and never drops rounds.
- Raw `curl` against the API returns **HTTP 403** (Cloudflare). A live browser context carries the
  clearance cookies — `page.evaluate(fetch(...))` reuses them transparently, so calls succeed.

## Two-phase pattern

1. **Extraction** — a browser `page.goto()` establishes Cloudflare clearance; all subsequent data
   is pulled via direct `page.evaluate(fetch(...))` API calls. Save raw JSON per round.
2. **Transformation** — read the raw round payloads, validate with Zod, transform to the domain
   shape, deduplicate, and persist. (Persistence target is out of scope for this skill.)

**Key technologies:** playwright-core (real Chrome, only for clearance), `page.evaluate(fetch(...))`
for authenticated API calls, Zod for boundary validation, TypeScript.

## ID resolution

The Dribl API uses opaque hashed IDs (e.g. `season=nPmrj2rmow`), not human names. Resolve them once
from the list endpoints and keep them in a **gitignored ID cache** keyed by league name. On a
regrade the tracked entity's league name changes, so the cache misses, the resolver re-resolves, and
the new IDs are cached — regrades are handled automatically.

**List endpoints (all require the `tenant` param):**

| What           | Endpoint                                                      | Notes                                                  |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Tenant ID      | `api/tenants?mc_link=<host>&slug=<slug>`                      | Returns a single object at `data.id` (not an array)    |
| Season ID      | `api/list/seasons?disable_paging=true&tenant=…`               | Match on `name` (e.g. "2026")                          |
| Competition ID | `api/list/competitions?disable_paging=true&tenant=…`          | Match on full competition `name`                       |
| League ID      | `api/list/leagues?disable_paging=true&tenant=…&competition=…` | Match on `name`; **skip** `(Removed)`-prefixed entries |

**Tenant note:** `api/tenants` returns `data` as a single object; every other list endpoint returns
`data` as an array.

**Cache-on-miss shape (illustrative):**

```json
{
  "tenant": "w8zdBWPmBX",
  "leagues": {
    "Girls' West 12B": {
      "season": "nPmrj2rmow",
      "competition": "Bjma0p6VdR",
      "league": "lNba4aGomx",
      "tenant": "w8zdBWPmBX"
    }
  }
}
```

**Resolver pattern:**

```typescript
export async function resolveLeagueIds(
  page: Page,
  leagueName: string,
  competitionName: string,
  seasonYear: string,
): Promise<DriblLeagueIds> {
  const cache = loadCache();
  if (cache.leagues[leagueName]) return cache.leagues[leagueName]; // cache hit

  const tenant = cache.tenant || (await resolveTenant(page));
  const season = await resolveSeasonId(page, tenant, seasonYear);
  const competition = await resolveCompetitionId(page, tenant, competitionName);
  const league = await resolveLeagueId(page, tenant, competition, leagueName);

  const ids = { season, competition, league, tenant };
  cache.tenant = tenant;
  cache.leagues[leagueName] = ids;
  saveCache(cache);
  return ids;
}
```

## Browser fetch helper

All API calls go through the browser context so Cloudflare cookies apply:

```typescript
async function browserFetch(page: Page, url: string): Promise<unknown> {
  const raw = await page.evaluate(async (u: string) => {
    const r = await fetch(u, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${u}`);
    return r.text();
  }, url);
  return JSON.parse(raw as string);
}
```

## Fixtures extraction (round-based)

**Single browser session for all teams.** One `page.goto()` at startup establishes clearance; each
team's rounds are fetched via `browserFetch` — no SPA navigation per team.

**URL builder:**

```typescript
function buildApiUrl(endpoint: string, ids: LeagueIds, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    season: ids.season,
    competition: ids.competition,
    league: ids.league,
    tenant: ids.tenant,
    timezone: "Australia/Melbourne",
    ...extra,
  });
  return `https://mc-api.dribl.com/api/${endpoint}?${params.toString()}`;
}
```

**Round loop:**

```typescript
async function crawlTeamByRounds(page, team, ids) {
  const chunks = [];
  let emptyStreak = 0;
  const maxConsecutiveEmptyRounds = 2;
  const maxRounds = 40; // hard safety cap

  for (let round = 1; round <= maxRounds; round++) {
    const url = buildApiUrl("fixtures", ids, { round: String(round) });
    const json = await browserFetch(page, url);
    const validated = externalFixturesApiResponseSchema.parse(json);

    if (validated.data.length === 0) {
      emptyStreak++;
      if (emptyStreak >= maxConsecutiveEmptyRounds) break;
      continue; // single gap round is not the end of the season
    }

    emptyStreak = 0;
    chunks.push(validated); // one payload per non-empty round
  }
  return chunks;
}
```

## Discovering teams in a table-less league

Some leagues (junior/MiniRoos age groups) never publish a table. To find out which teams play in
one, don't round-walk — call `api/fixtures` with **no `round` param**. Dribl then returns its
current window, the same fixtures the site shows by default:

```typescript
async function discoverCurrentTeams(page, ids) {
  const url = buildApiUrl("fixtures", ids); // no round param
  const json = await browserFetch(page, url);
  const validated = externalFixturesApiResponseSchema.parse(json);
  return validated.data; // home/away teams currently playing this league
}
```

This is one call, not a walk, and — unlike sampling a fixed early round window — it never goes
stale: a team that starts mid-season shows up here as soon as it plays, on the next crawl. A team
on a bye right now is still missed, but self-heals next time round. This is discovery only; it's
not a substitute for the round-walk above when you need a team's full fixture history.

## Table extraction

After the round crawl, hit `api/ladders` (Dribl's table endpoint) directly with the same IDs — no
SPA navigation:

```typescript
async function crawlTeamTable(page, ids) {
  const url = buildApiUrl("ladders", ids);
  const json = await browserFetch(page, url);
  const validated = externalTableApiResponseSchema.parse(json);
  if (validated.data.length === 0) return undefined; // e.g. MiniRoos have no table
  return validated;
}
```

## API endpoints

| Endpoint       | Params                                               | Response                           |
| -------------- | ---------------------------------------------------- | ---------------------------------- |
| `api/fixtures` | season, competition, league, round, tenant, timezone | `{ data: fixture[], links, meta }` |
| `api/ladders`  | season, competition, league, tenant, timezone        | `{ data: tableEntry[] }`           |
| `api/list/*`   | tenant (+ competition for leagues)                   | `{ data: item[] }`                 |
| `api/tenants`  | mc_link, slug                                        | `{ data: object }` (single object) |

Clubs use a one-off list call (`api/list/clubs?disable_paging=true`); it can be captured either via
`browserFetch` or SPA response interception (`page.waitForResponse`).

## Boundary validation

Always validate with Zod at both boundaries — API response → external schema, and transform output →
internal/domain schema. Typical schemas:

- `externalFixturesApiResponseSchema` — `{ data: fixture[], links?, meta? }`
- `externalTableApiResponseSchema` — `{ data: tableEntry[] }`

## Deduplication

Round payloads can overlap (e.g. a completed result also appearing in an upcoming view). Dedup by a
stable composite key — round + home team id + away team id — preferring completed/score-bearing
records so real results win over placeholders:

```typescript
const seen = new Set<string>();
const unique = items.filter((item) => {
  const key = `${item.round}:${item.homeTeamId}:${item.awayTeamId}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

## Best practices

**Cloudflare clearance:**

- One `page.goto()` per browser session is enough — clearance persists for all `fetch()` calls.
- Wait ~3s after the goto before starting API calls.
- Keep the same page alive; don't close and reopen between teams.

**Empty-round handling:**

- Stop after `maxConsecutiveEmptyRounds = 2` consecutive empty rounds.
- A single empty round is a scheduling gap, not the end of the season.
- `maxRounds = 40` is a hard safety cap.

**ID cache:**

- Re-resolve any league name not in cache — this handles regrades automatically.
- Tenant ID is stable; only re-fetch it if the cache is empty.
- Skip `(Removed)`-prefixed league names (old/regraded leagues).

**Error handling & session:**

- Run a single browser session; collect per-team failures and continue to the next team.
- Throw once at the end if any team failed, so the caller sees partial failure.
- Close the browser in a `finally` block regardless of outcome.

**Single-browser session skeleton:**

```typescript
let browser: Browser | undefined;
const failures: string[] = [];
try {
  browser = await chromium.launch({ headless: false, channel: "chrome" });
  const page = await (await browser.newContext({ userAgent: "..." })).newPage();
  await page.goto(siteUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  for (const team of teams) {
    try {
      const ids = await resolveLeagueIds(page, team.league, team.competition, team.season);
      // crawlTeamByRounds(page, team, ids) / crawlTeamTable(page, ids)
    } catch {
      failures.push(team.slug);
    }
  }
} finally {
  if (browser) await browser.close();
}
if (failures.length > 0) throw new Error(`Failed: ${failures.join(", ")}`);
```

## CI note

On Linux CI, headed Chrome needs a virtual display — wrap the crawl with `xvfb-run
--auto-servernum` and install Chrome via `npx playwright install --with-deps chrome`. Rebuild the ID
cache each CI run rather than committing it.
