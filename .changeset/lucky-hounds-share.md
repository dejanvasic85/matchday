---
"@dejanvasic85/matchday-sdk": minor
---

Auto-paging helpers: stop hand-rolling the `nextCursor` loop.

`listAllClubs`, `listAllTeams`, `listAllCompetitions`, `listAllSeasons` and `listAllLeagues` follow `nextCursor` to the end and return one array:

```ts
// Before
const all = [];
let cursor;
do {
  const { data } = await client.GET("/clubs", { params: { query: { cursor } } });
  all.push(...data.data);
  cursor = data.nextCursor;
} while (cursor);

// After
const clubs = await listAllClubs(client); // Result<Club[]>
```

Each accepts filters (`listAllTeams(client, { clubId })`) plus `{ signal, limit, maxPages }` — `limit` defaults to 500, the server's max; `maxPages` to 100, so a server bug is an `err` Result rather than an endless loop. Any page failing returns that failure, never a partial list.

`fetchAllPages` exposes the same loop for routes the helpers don't cover, taking a fetch-one-page callback so it works with any paged route and filter combination.

`getClubLeagues` is unchanged but now `listAllLeagues(client, { clubId })` under the hood, and takes the same paging options.
