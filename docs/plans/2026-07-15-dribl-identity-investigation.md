# Dribl entity-identity investigation

- Date: 2026-07-15
- Status: findings (input to ADR 0012)

## Purpose

Before committing the clubs-sync / competition-crawl data model, establish **what stable
identifiers Dribl actually exposes on the crawl path**, so entity resolution keys on something
durable rather than mutable data (e.g. a logo URL that changes on rebrand).

Method: real-browser Cloudflare clearance on `fv.dribl.com`, then direct `mc-api.dribl.com` calls
(`page.evaluate(fetch(...))`) plus SPA network capture, against the live Football Victoria tenant
(`tenant=w8zdBWPmBX`, season `2026`).

## What each endpoint carries for club/team identity

| Endpoint                                                       | Stable club id? | Stable team id?     | Club fields present                                 |
| -------------------------------------------------------------- | --------------- | ------------------- | --------------------------------------------------- |
| `list/clubs`                                                   | ✅ `data[].id`  | —                   | name, image, email, url, address, socials (no code) |
| `clubs/{id}`                                                   | ✅ `data.id`    | —                   | + grounds, color, accent, email_address, store      |
| `ladders`                                                      | ❌              | ✅ `team_hash_id`   | club_code, club_name, club_logo (per team row)      |
| `fixtures`                                                     | ❌              | ✅ `*_team_hash_id` | home/away_logo, home/away_team_name (no club id)    |
| `list/teams`, `teams/{id}`, `clubs/{id}/teams`, `matches/{id}` | —               | —                   | **routes do not exist (400)**                       |

**Confirmed:** Dribl exposes **no team→club link** anywhere — not in HTML, not in SPA network
traffic, not via `include=` params (ignored), not via any probed route. The API is flat.

## The crawl-path stable ids

- **`team_hash_id`** — present on every ladder and fixture row. The only rock-solid stable id on
  the crawl path.
- **`club_code`** (e.g. `"OAKC"`) — present on every ladder row, but **only in ladder data**; the
  club record (`list/clubs`, `clubs/{id}`) has **no code field**.

## club_code quality (measured)

Crawl of 60 leagues across 20 competitions → **654 club rows, 218 distinct clubs**:

| Test                                    | Result                                             |
| --------------------------------------- | -------------------------------------------------- |
| `club_code` present                     | **100%** (0 missing)                               |
| `club_code` ↔ `club_name` ↔ `club_logo` | **1:1:1** — 218=218=218, 0 collisions, 0 splits    |
| Ladder clubs → `list/clubs` **by logo** | **100% matched** (218/218), 0 name fallback needed |
| `club_code` on the club record          | **absent** — cannot join code→club_id directly     |

## Implications for identity

1. **`team_hash_id` is the durable team key** → `external_ref(source=dribl, sourceId=team_hash_id)`.
   Teams resolve exactly from ladders/fixtures; they never duplicate on rescrape.
2. **`club_code` is the durable club key _for crawled data_.** It is always present, perfectly
   unique, and survives logo _and_ name changes (unlike either). Model it as the club's crawl-path
   source id.
3. **Logo is an enrichment-join hint, not identity.** It bridges ladder↔`list/clubs` 100% _today_,
   but it is mutable — so it links clubs-sync metadata (grounds, colours, address) onto a club that
   already exists via `club_code`. If logo drift ever breaks the join, the club is still correct;
   only the metadata enrichment lags until re-linked.
4. **The ladder row already supplies the team→club association** Dribl otherwise hides: each
   `team_hash_id` row carries its `club_code`/`club_name`/`club_logo`. No clubs-sync call is needed
   to link a team to its club.

## Bonus findings (separate backlog)

- **Richer club data on `clubs/{id}`** the list endpoint nulls out: `grounds` ({name, address}),
  `color`/`accent` (brand), `email_address`, `store` (legacy `/club/{n}`). Worth a club-enrichment
  job.
- **`driblListResponseSchema` mismatch:** `list/competitions` and `list/leagues` return `name`/`id`
  at the **top level**, not under `attributes` as the schema expects. Verify + fix.
- **`socials[].name`** only ever `facebook`/`instagram`/`twitter` across 348 clubs, but the strict
  Zod enum would fail the whole sync on a new platform value — loosen to a tolerant parse.
- Ladder rows embed full `recent_matches`/`upcoming_matches` (scores, half-time, penalties, round,
  status) — a fixtures data source for the competition crawl to consider.

## Open (not blocking)

- Is `club_code` stable **across seasons** (only 2026 sampled)?
- Do no-ladder competitions (MiniRoos) still yield `club_code` via fixtures?
