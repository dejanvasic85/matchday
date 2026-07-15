# 0012. Entity resolution & crawl-path identity

- Status: decided
- Date: 2026-07-15
- Amends: 0011 (data model), 0005 (identifiers)

## Context

0011 modelled `team.clubId` as a mandatory FK and assumed every entity resolves via an
`external_ref` keyed on a Dribl id. A live investigation of the Dribl API
([docs/plans/2026-07-15-dribl-identity-investigation.md](../plans/2026-07-15-dribl-identity-investigation.md))
shows that assumption doesn't hold on the crawl path:

- **Clubs have a stable Dribl id, but it only appears in `list/clubs` / `clubs/{id}`.** Neither
  `ladders` nor `fixtures` carry a club id, and **no endpoint links a team to its club** (probed
  routes 400; `include=` params ignored; SPA uses the same flat endpoints).
- **`team_hash_id` is the only rock-solid stable id on the crawl path** (present on every ladder
  and fixture row).
- **`club_code` is a stable, always-present, perfectly unique club key — but only in ladder data**
  (measured 1:1:1 with name and logo across 654 rows / 218 clubs; the club record has no code
  field).
- **Logo is mutable** (content-addressed R2 hash; changes on rebrand) so it cannot anchor identity,
  even though it currently bridges ladders↔`list/clubs` at 100%.

The original "resolve club by logo/name on every table crawl" approach is therefore fragile: a
rebrand breaks the logo match and a name-suffix drift (`"Oakleigh Cannons FC"` vs
`"…FC Seniors"`) breaks the name match — either silently creating duplicate clubs.

## Options

- **Club identity = Dribl club id, matched from ladders by logo/name.** Rejected: the crawl path
  has no club id, and logo/name are both mutable → duplicates on rebrand/rename.
- **No club entity from the crawl; teams are club-agnostic, joined by name at read time.** Rejected:
  pushes a fuzzy problem to every API consumer and loses club grouping.
- **Two independent club source-ids: `club_code` (from crawl) and the Dribl club id (from
  clubs-sync), reconciled by logo as a one-time hint.** Chosen — see below.

## Recommendation

### Identity keys

Resolve entities by the **most stable id each path exposes**, via `external_ref`:

| Entity | `external_ref` source id (crawl path)      | Notes                                             |
| ------ | ------------------------------------------ | ------------------------------------------------- |
| team   | `team_hash_id`                             | Ladders + fixtures. Rock solid; never duplicates. |
| club   | **`club_code`** (source `dribl_club_code`) | Ladders. Always present, unique, rebrand-stable.  |
| club   | Dribl club id (source `dribl`)             | clubs-sync only. Enables detail enrichment.       |

A club may therefore hold **two** external refs (distinct `source` values) — `dribl_club_code`
(crawl authority) and `dribl` (clubs-sync). The unique `(entityType, internalId, source)` index in
0011 already permits one ref per source per entity, so this needs no schema change to `external_ref`.

### team → club association

The **ladder row already supplies it**: each `team_hash_id` row carries its `club_code`. So the
competition crawl resolves the team's club by `club_code` (creating the club if unseen) and sets
`team.clubId` from that — no clubs-sync dependency, no logo/name guessing.

`team.clubId` becomes **nullable** (0011 had it mandatory): a team first seen via a payload lacking
`club_code` (e.g. a fixture-only edge case) is stored with a null `clubId` and linked later, rather
than blocking ingest or fabricating a club.

### clubs-sync's role

Clubs-sync is **enrichment, not crawl-path identity**. It upserts the Dribl club record (grounds,
colours, address, socials — 0004 depth) keyed on the Dribl club id, and attaches to the
`club_code`-identified club **by logo match** (the 100%-today bridge). If logo drift ever breaks
that join, the club still exists and is correct via `club_code`; only the enrichment lags until
re-linked. Clubs-sync never creates a competing club row for a club already known by `club_code`.

### Resolution order (club)

1. `external_ref(dribl_club_code, club_code)` → existing internal id (authoritative).
2. else create club, write the `dribl_club_code` ref.
3. clubs-sync separately: match by logo to attach the `dribl` ref + enrichment; never create a
   duplicate when a `club_code` club matches.

## Consequences

- `team.clubId` becomes **nullable** in the 0011 schema; a migration relaxes the constraint.
- `external_ref.source` gains a second value `dribl_club_code` alongside `dribl`; the source union
  in `packages/domain` constants must list both.
- The Phase-3 competition crawl owns club creation (via `club_code`), inverting the earlier plan
  where the table crawl matched clubs by logo (`resolveClub.ts` is superseded by `club_code`
  resolution; its logo/name lookup is retained only for clubs-sync's enrichment attach).
- Clubs-sync is re-scoped from "authoritative club source" to "club enrichment"; it no longer needs
  to run before the competition crawl to avoid duplicates.
- Enrichment fields (grounds, colours) still need a data-model home — deferred to a follow-up
  (see the investigation doc's bonus findings and todo.md).
