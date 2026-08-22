---
"@dejanvasic85/matchday-sdk": minor
---

`League` responses now embed `competition` and `season` as `{ id, name }` summaries, so labelling a league no longer needs follow-up calls to `/competitions` and `/seasons`.

Applies to `GET /leagues` (including `?clubId=`) and `GET /leagues/{id}`. `competitionId`/`seasonId` are unchanged and still present — this is additive.

```ts
const { data } = await client.GET("/leagues", { params: { query: { clubId } } });
data?.forEach((l) => console.log(`${l.name} — ${l.competition.name} (${l.season.name})`));
```
