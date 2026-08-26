---
"@dejanvasic85/matchday-sdk": major
---

**Breaking:** list endpoints return a page, not a bare array.

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
