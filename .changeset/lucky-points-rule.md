---
"@dejanvasic85/matchday-sdk": minor
---

Add `hasTable` to the league response. Indicates whether a league publishes a ladder/table on
Dribl — some junior leagues (e.g. MiniRoos age groups) never do. `false` for leagues crawled
before this field existed, until the next catalog crawl sets it explicitly.
