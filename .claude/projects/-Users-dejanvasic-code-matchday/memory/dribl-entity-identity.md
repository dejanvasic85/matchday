---
name: dribl-entity-identity
description: How Dribl entity identity works on the crawl path; club_code is the stable club key, not logo
metadata:
  type: project
---

Established by a live Dribl API investigation (2026-07-15), recorded in ADR 0012 and
`docs/plans/2026-07-15-dribl-identity-investigation.md`.

- The **crawl path** (`ladders`/`fixtures`) carries **no stable club id** and **no team→club
  link** (probed routes 400; `include=` ignored; SPA uses the same flat endpoints).
- Stable ids: **`team_hash_id`** (teams) and **`club_code`** (clubs, ladder rows only — measured
  1:1 with name/logo across 654 rows / 218 clubs, zero collisions).
- **Logo is mutable** (content-addressed R2 hash; changes on rebrand) → an enrichment-join hint,
  never identity.
- Resolution (0012): team by `team_hash_id`; club by `club_code` (source `dribl_club_code`);
  clubs-sync is *enrichment* keyed on the Dribl club id, attaching by logo, never duplicating a
  `club_code` club. `team.clubId` is nullable.
- `list/*` items (competitions/leagues/seasons) return `name`/`id` at the **top level**, NOT under
  `attributes` (the `clubs`/`ladders` payloads use `attributes`).
- Richer club data (grounds, color/accent, email_address, store) lives only on the single-club
  `clubs/{id}` detail endpoint, nulled out in `list/clubs` — future club-enrichment job.

Verify the crawler/entity-resolution code still matches this before relying on it.
