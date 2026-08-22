# @dejanvasic85/matchday-sdk

Typed client for the matchday API, generated from its live OpenAPI spec (ADR 0007). Every
protected route needs a per-client bearer token (ADR 0013) — `createMatchdayClient` sets that
header for you.

## Install

Published to **GitHub Packages**, not the public npm registry. Even though the matchday repo is
public, installing a GitHub Packages package still requires an authenticated `npm`/`pnpm` — create
a [personal access token with `read:packages`](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-with-a-personal-access-token)
(this is **not** the same as CI's auto-provided `GITHUB_TOKEN` — that one can't read across repos),
store it as `MATCHDAY_SDK_TOKEN`, and add to your project's `.npmrc`:

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

`data`/`error` and every request/response shape are typed from the spec — see
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/) for the full calling convention.

### Task helpers

Wrappers that encode _what to ask for_, so you don't rebuild a full-catalog fetch-and-join:

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

Prefer `getLeagueTeams` over `GET /teams` + `GET /clubs`: the full catalog is ~6500 teams and
2.4 MB to resolve the handful in one league.

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

Versioning/publishing is handled by [changesets](https://github.com/changesets/changesets). Any
PR that changes this package should include a changeset describing the bump:

```sh
pnpm changeset
```

On merge to `main`, CI (`release-sdk.yml`) either opens/updates a "Version Packages" PR (bumping
`package.json` + `CHANGELOG.md`) or, once that PR is merged, publishes the new version straight to
GitHub Packages. No manual version bumps or `npm publish`.
