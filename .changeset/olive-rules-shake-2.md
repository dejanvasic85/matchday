---
"@dejanvasic85/matchday-sdk": patch
---

`getClubLeagues` follows `nextCursor` to the end, so it still returns every league a club's teams play in now that `GET /leagues` is paged. Its signature is unchanged — `Result<League[]>`.

In practice this is a single request: one club's leagues fit in one max-size page.
