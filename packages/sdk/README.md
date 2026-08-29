# @dejanvasic85/matchday-sdk

A typed client for the matchday API, generated from its live OpenAPI spec. Every protected route
needs a per-client bearer token, and `createMatchdayClient` sets that header for you.

## Install

We publish to **GitHub Packages**, not to the public npm registry. The matchday repo is public,
but installing from GitHub Packages still needs an authenticated `npm` or `pnpm`. To set that up:

1. Create a
   [personal access token with `read:packages`](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token).
   This is **not** the `GITHUB_TOKEN` that CI provides automatically, which cannot read across
   repos.
2. Store it as `MATCHDAY_SDK_TOKEN`.
3. Add this to your project's `.npmrc`:

```ini
@dejanvasic85:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${MATCHDAY_SDK_TOKEN}
```

Then:

```sh
pnpm add @dejanvasic85/matchday-sdk
```

## Usage

```ts
import { createMatchdayClient } from "@dejanvasic85/matchday-sdk";

const client = createMatchdayClient({
  baseUrl: "https://api.matchday.example",
  apiToken: process.env.MATCHDAY_API_TOKEN,
  timeoutMs: 30_000, // optional, default 30s
  retries: 2, // optional, default 2 — idempotent requests only, on 5xx/network
});

const { data, error } = await client.GET("/clubs");
```

The spec types `data`, `error` and every request and response shape. See
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/) for the full calling convention.

### Task helpers

These wrappers encode _what to ask for_, so you never rebuild a fetch-and-join across the whole
catalog:

| Function                              | Returns                                           |
| ------------------------------------- | ------------------------------------------------- |
| `getLeagueOverview(client, leagueId)` | league + fixtures + table + teams, in one request |
| `getLeagueTeams(client, leagueId)`    | a league's teams, each with its club embedded     |
| `getClubLeagues(client, clubId)`      | every league a club's teams play in               |

```ts
import { getLeagueOverview } from "@dejanvasic85/matchday-sdk";

const result = await getLeagueOverview(client, "lea_V1StGXR8Z5");
if (result.ok) {
  console.log(result.value.name, result.value.fixtures.length);
}
```

Use `getLeagueTeams` rather than `GET /teams` plus `GET /clubs`. The full catalog runs to roughly
6,500 teams and 2.4 MB, which is a lot to download to resolve the handful in one league.

### Auto-paging

List routes return `{ data, nextCursor }`. The `listAll*` helpers follow `nextCursor` to the end
and hand you one array, so you write no cursor loop:

```ts
import { listAllClubs, listAllLeagues, listAllTeams } from "@dejanvasic85/matchday-sdk";

const clubs = await listAllClubs(client);
if (clubs.ok) {
  console.log(clubs.value.length); // every club, however many pages that took
}

// Filters are applied server-side — always prefer one over walking a full catalog
const teams = await listAllTeams(client, { clubId: "clb_V1StGXR8Z5" });
const leagues = await listAllLeagues(client, { seasonId: "sea_V1StGXR8Z5" });
```

| Function                            | Returns                                             |
| ----------------------------------- | --------------------------------------------------- |
| `listAllClubs(client)`              | every club                                          |
| `listAllTeams(client, { clubId? })` | every team, optionally scoped to one club           |
| `listAllCompetitions(client)`       | every competition                                   |
| `listAllSeasons(client)`            | every season                                        |
| `listAllLeagues(client, filter)`    | every league by `competitionId`/`seasonId`/`clubId` |

Each helper takes an optional third argument, `{ signal, limit, maxPages }`. `limit` defaults to
500, the server's maximum, so a walk costs the fewest round trips. `maxPages` defaults to 100, and
past that you get an `err` Result rather than an endless loop. If any page fails, you get that
failure back — never a partial list that looks complete.

For a route these helpers do not cover, `fetchAllPages` runs the same loop and leaves the request
to you:

```ts
import { fetchAllPages, type components } from "@dejanvasic85/matchday-sdk";

type Season = components["schemas"]["Season"];

const seasons = await fetchAllPages<Season>((query, signal) =>
  client.GET("/seasons", { params: { query }, signal }),
);
```

Treat paging as a guard rail, not as the way in. If you find yourself walking the whole of
`/teams`, a filter or a league-scoped route almost certainly does the same job in one request.

### Handling errors

`unwrap` turns a call into a `Result`, so you stop repeating `if (error || !data) throw`:

```ts
import { unwrap, unwrapOrThrow } from "@dejanvasic85/matchday-sdk";

const result = unwrap(await client.GET("/clubs"));
if (!result.ok) {
  console.error(result.error.status, result.error.message);
}

// Or throw at a transport boundary:
const clubs = unwrapOrThrow(await client.GET("/clubs"));
```

`result.error.status` is the HTTP status, or `"timeout"` / `"network"` when no response arrived.

## Releasing

[Changesets](https://github.com/changesets/changesets) handles versioning and publishing. Every PR
that changes this package must include a changeset describing the bump:

```sh
pnpm changeset
```

When you merge to `main`, the `release-sdk.yml` workflow does one of two things. It either opens
or updates a "Version Packages" PR, which bumps `package.json` and `CHANGELOG.md`; or, once you
merge that PR, it publishes the new version straight to GitHub Packages. Never bump the version or
run `npm publish` by hand.
