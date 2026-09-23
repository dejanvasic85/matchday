---
"matchday-sdk": minor
---

Search clubs by name: `listAllClubs(client, { name: "Williamstown" })` returns clubs whose name
contains that text, ignoring case. Paging options move to the third argument, matching
`listAllTeams`. Paging on `/clubs`, `/competitions` and `/seasons` now follows `limit` and
`cursor`; before, every request returned the first page, so `listAllClubs` failed after 100 pages.
