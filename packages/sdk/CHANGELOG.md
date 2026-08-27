# @dejanvasic85/matchday-sdk

## 2.1.0

### Minor Changes

- 4746a56: Auto-paging helpers: stop hand-rolling the `nextCursor` loop.

  `listAllClubs`, `listAllTeams`, `listAllCompetitions`, `listAllSeasons` and `listAllLeagues` follow `nextCursor` to the end and return one array:

  ```ts
  // Before
  const all = [];
  let cursor;
  do {
    const { data } = await client.GET("/clubs", { params: { query: { cursor } } });
    all.push(...data.data);
    cursor = data.nextCursor;
  } while (cursor);

  // After
  const clubs = await listAllClubs(client); // Result<Club[]>
  ```

  Each accepts filters (`listAllTeams(client, { clubId })`) plus `{ signal, limit, maxPages }` — `limit` defaults to 500, the server's max; `maxPages` to 100, so a server bug is an `err` Result rather than an endless loop. Any page failing returns that failure, never a partial list.

  `fetchAllPages` exposes the same loop for routes the helpers don't cover, taking a fetch-one-page callback so it works with any paged route and filter combination.

  `getClubLeagues` is unchanged but now `listAllLeagues(client, { clubId })` under the hood, and takes the same paging options.

## 2.0.0

### Major Changes

- a732420: **Breaking:** list endpoints return a page, not a bare array.

  `GET /clubs`, `/teams`, `/competitions`, `/seasons` and `/leagues` return `{ data, nextCursor }` instead of `T[]`. Accessing `.data` is the only change most callers need.

  ```ts
  // Before
  const { data } = await client.GET("/leagues");
  data?.forEach(...);

  // After
  const { data } = await client.GET("/leagues");
  data?.data.forEach(...);
  ```

  Each accepts `limit` (default 100, max 500 — clamped, not rejected) and `cursor`. Follow `nextCursor` until it is `null`; an invalid cursor is a 400.

  Paging is a **guard rail, not the intended access path**. Unscoped `GET /teams` is ~6500 rows; if you need a subset, reach for a filter (`/leagues/{id}/teams`, `?clubId=`) rather than looping pages.

  > ⚠️ This change shipped in **1.1.0**, which was published as a minor by mistake — its changeset was never committed. Treat 1.1.0 as breaking; upgrade to this release instead.

## 1.1.0

### Minor Changes

- 700e479: `League` responses now embed `competition` and `season` as `{ id, name }` summaries, so labelling a league no longer needs follow-up calls to `/competitions` and `/seasons`.

  Applies to `GET /leagues` (including `?clubId=`) and `GET /leagues/{id}`. `competitionId`/`seasonId` are unchanged and still present — this is additive.

  ```ts
  const { data } = await client.GET("/leagues", { params: { query: { clubId } } });
  data?.forEach((l) => console.log(`${l.name} — ${l.competition.name} (${l.season.name})`));
  ```

- d23c633: `GET /leagues/{id}/overview` — a league plus its `fixtures`, `table` and `teams` in one response, for rendering a league page in a single round-trip.

  All three collections are always present (empty arrays when the league has none), so nothing needs null-checking. Use `/leagues/{id}/fixtures`, `/table` or `/teams` when only one is needed.

  ```ts
  const { data } = await client.GET("/leagues/{id}/overview", {
    params: { path: { id: leagueId } },
  });
  console.log(data?.name, data?.competition.name, data?.fixtures.length, data?.table.length);
  ```

- 16c743c: Ergonomics: the SDK now handles timeouts, retries and error-unwrapping, so consumers stop hand-rolling them.

  **`createMatchdayClient` options** — `timeoutMs` (default 30s), `retries` (default 2), `retryDelayMs` (default 250ms). Retries apply to idempotent requests only, on 5xx or a failed request — never a 4xx.

  **`unwrap(outcome)` → `Result<T>`** — turns a `client.GET(...)` result into `{ ok: true, value }` or `{ ok: false, error }`, replacing `if (error || !data) throw new Error(...)`. `error.status` is the HTTP status, or `"timeout"` / `"network"` when no response arrived.

  **`unwrapOrThrow(outcome)` → `T`** — same, but throws a `MatchdayApiError` carrying `status`.

  **Task helpers** — pass the client, get the data:

  - `getLeagueOverview(client, leagueId)` — league + fixtures + table + teams in one request
  - `getLeagueTeams(client, leagueId)` — a league's teams with clubs embedded; prefer over `/teams` + `/clubs`, which is ~6500 teams and 2.4 MB
  - `getClubLeagues(client, clubId)` — every league a club's teams play in

  ```ts
  import { createMatchdayClient, getLeagueOverview } from "@dejanvasic85/matchday-sdk";

  const client = createMatchdayClient({ baseUrl, apiToken, timeoutMs: 30_000 });
  const result = await getLeagueOverview(client, "lea_V1StGXR8Z5");
  if (result.ok) console.log(result.value.fixtures.length, result.value.table.length);
  ```

### Patch Changes

- 745becb: `getClubLeagues` follows `nextCursor` to the end, so it still returns every league a club's teams play in now that `GET /leagues` is paged. Its signature is unchanged — `Result<League[]>`.

  In practice this is a single request: one club's leagues fit in one max-size page.

## 1.0.0

### Major Changes

- a75298c: `GET /leagues/{id}/teams` — list a league's teams (works for table-less leagues like MiniRoos, unlike deriving membership from the league's table).

  Team responses are now a `type: "club" | "unaffiliated"` discriminated union: `club` is guaranteed present (never null) when `type` is `"club"`, and absent otherwise — a team not yet bridged to a club is the rare, self-healing exception, not something every caller needs to null-check.

  `GET /leagues?clubId=` now includes leagues that have never published a table (e.g. MiniRoos age groups) — previously silently omitted, even though the club's teams played in them.

### Patch Changes

- 1b4d4d7: bumping

## 0.2.0

### Minor Changes

- 8dab0b7: `GET /leagues` accepts a new `clubId` query filter — leagues a club's teams play in, composable with the existing `competitionId`/`seasonId` filters.

## 0.1.0

### Minor Changes

- edac7cc: Initial release: typed client generated from the matchday OpenAPI spec.
