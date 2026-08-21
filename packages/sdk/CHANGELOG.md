# @dejanvasic85/matchday-sdk

## 1.0.0

### Major Changes

- a75298c: `GET /leagues/{id}/teams` — list a league's teams (works for table-less leagues like MiniRoos, unlike deriving membership from the league's table).
  
  Team responses are now a `type: "club" | "unaffiliated"` discriminated union: `club` is guaranteed present (never null) when `type` is `"club"`, and absent otherwise — a team not yet bridged to a club is the rare, self-healing exception, not something every caller needs to null-check.
  
  `GET /leagues?clubId=` now includes leagues that have never published a table (e.g. MiniRoos age groups) — previously silently omitted, even though the club's teams played in them.

## 0.2.0

### Minor Changes

- 8dab0b7: `GET /leagues` accepts a new `clubId` query filter — leagues a club's teams play in, composable with the existing `competitionId`/`seasonId` filters.

## 0.1.0

### Minor Changes

- edac7cc: Initial release: typed client generated from the matchday OpenAPI spec.
