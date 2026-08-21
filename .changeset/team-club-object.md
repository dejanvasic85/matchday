---
"@dejanvasic85/matchday-sdk": major
---

`GET /leagues/{id}/teams` — list a league's teams (works for table-less leagues like MiniRoos, unlike deriving membership from the league's table).

Team responses are now a `type: "club" | "unaffiliated"` discriminated union: `club` is guaranteed present (never null) when `type` is `"club"`, and absent otherwise — a team not yet bridged to a club is the rare, self-healing exception, not something every caller needs to null-check.

`GET /leagues?clubId=` now includes leagues that have never published a table (e.g. MiniRoos age groups) — previously silently omitted, even though the club's teams played in them.
