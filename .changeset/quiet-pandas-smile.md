---
"@dejanvasic85/matchday-sdk": minor
---

Ergonomics: the SDK now handles timeouts, retries and error-unwrapping, so consumers stop hand-rolling them.

**`createMatchdayClient` options** — `timeoutMs` (default 30s), `retries` (default 2), `retryDelayMs` (default 250ms). Retries apply to idempotent requests only, on 5xx or a failed request — never a 4xx.

**`unwrap(outcome)` → `Result<T>`** — turns a `client.GET(...)` result into `{ ok: true, value }` or `{ ok: false, error }`, replacing `if (error || !data) throw new Error(...)`. `error.status` is the HTTP status, or `"timeout"` / `"network"` when no response arrived.

**`unwrapOrThrow(outcome)` → `T`** — same, but throws a `MatchdayApiError` carrying `status`.

**Task helpers** — pass the client, get the data:

- `getLeagueOverview(client, leagueId)` — league + fixtures + table + teams in one request
- `getLeagueTeams(client, leagueId)` — a league's teams with clubs embedded; prefer over `/teams` + `/clubs`, which is ~6500 teams and 2.4 MB
- `getClubLeagues(client, clubId)` — every league a club's teams play in

```ts
import { createMatchdayClient, getLeagueOverview } from "@dejanvasic85/matchday-sdk";

const client = createMatchdayClient({ baseUrl, apiToken, timeoutMs: 30_000 });
const result = await getLeagueOverview(client, "lea_V1StGXR8Z5");
if (result.ok) console.log(result.value.fixtures.length, result.value.table.length);
```
