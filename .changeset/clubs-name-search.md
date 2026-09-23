---
"matchday-sdk": minor
---

`GET /clubs` now takes a `name` query parameter. It returns clubs whose name contains that text,
ignoring case. Paging on `/clubs`, `/competitions` and `/seasons` now follows `limit` and `cursor`;
before, every request returned the first page, so `listAllClubs` failed after 100 pages.
