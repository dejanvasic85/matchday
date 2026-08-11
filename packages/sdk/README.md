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
});

const { data, error } = await client.GET("/clubs");
```

`data`/`error` and every request/response shape are typed from the spec — see
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/) for the full calling convention.

## Releasing

Versioning/publishing is handled by [changesets](https://github.com/changesets/changesets). Any
PR that changes this package should include a changeset describing the bump:

```sh
pnpm changeset
```

On merge to `main`, CI (`release-sdk.yml`) either opens/updates a "Version Packages" PR (bumping
`package.json` + `CHANGELOG.md`) or, once that PR is merged, publishes the new version straight to
GitHub Packages. No manual version bumps or `npm publish`.
