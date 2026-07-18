# Dribl entity-identity investigation

- Date: 2026-07-15
- Status: findings (input to ADR 0012)

## Purpose

Before committing the ingest data model, establish **what stable identifiers Dribl actually exposes
on the crawl path**, so entity resolution keys on something durable rather than mutable data (e.g. a
logo URL that changes on rebrand).

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

## Administrative pseudo-"clubs"

`list/clubs` includes **11 entities that share a placeholder logo** and are administrative, not real
clubs: 9 regional referee bodies (`FV Ballarat Referees`, `FV Bendigo Referees`, …), `FV
Registrations`, and `FV Academy`.

- The 9 referees + `FV Registrations` **never appear on any ladder** (checked across ~85 leagues).
- **`FV Academy` is the exception** — it fields teams and _does_ appear on ladders.

So the distinguishing signal is **not** name or shared logo — it's **ladder presence**. A real club
appears on a ladder (has a `club_code`); an admin entity never does. This is why clubs must be
discovered from ladders, not enumerated from `list/clubs` (which would ingest the admin junk and,
because they share a logo, cause false-merges / a unique-constraint violation on a second `dribl`
ref).

## Implications for identity

1. **`team_hash_id` is the durable team key** → `external_ref(dribl, team_hash_id)`.
2. **`club_code` is the durable club key** — always present, unique, survives logo _and_ name
   changes. Model it as the club's crawl-path source id (`external_ref(dribl_club_code, club_code)`).
3. **Logo is an enrichment-join hint, not identity** — mutable, and shared by admin pseudo-clubs.
4. **The ladder row already supplies the team→club association** Dribl otherwise hides: each
   `team_hash_id` row carries its `club_code`.

## Bonus findings

- **Richer club data on `clubs/{id}`** the list endpoint nulls out: `grounds` ({name, address}),
  `color`/`accent` (brand), `email_address`, `store`. Worth a club-enrichment job.
- **`driblListResponseSchema` mismatch:** `list/competitions` and `list/leagues` return `name`/`id`
  at the **top level**, not under `attributes` as the schema expects — a latent bug to fix.
- **`socials[].name`** only ever `facebook`/`instagram`/`twitter` across 348 clubs, but a strict Zod
  enum would fail the whole sync on a new platform value — loosen to a tolerant parse.
- Ladder rows embed full `recent_matches`/`upcoming_matches` (scores, half-time, penalties, round,
  status) — a fixtures data source for the deep crawl to consider.

## Open (not blocking)

- Is `club_code` stable **across seasons** (only 2026 sampled)?
- Do no-ladder competitions (MiniRoos) still yield `club_code` via fixtures?
- Is a Dribl **league** identified stably across seasons/regrades (the subscription key)?
