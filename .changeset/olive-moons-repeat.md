---
"@dejanvasic85/matchday-sdk": minor
---

`GET /leagues/{id}/overview` — a league plus its `fixtures`, `table` and `teams` in one response, for rendering a league page in a single round-trip.

All three collections are always present (empty arrays when the league has none), so nothing needs null-checking. Use `/leagues/{id}/fixtures`, `/table` or `/teams` when only one is needed.

```ts
const { data } = await client.GET("/leagues/{id}/overview", { params: { path: { id: leagueId } } });
console.log(data?.name, data?.competition.name, data?.fixtures.length, data?.table.length);
```
