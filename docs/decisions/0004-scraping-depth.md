# 0004. Scraping depth

- Status: proposed
- Date: 2026-07-12

## Context

The current pipeline captures enough to render fixtures, results, and ladders: fixture
date/time/round/venue/coordinates, both teams, scores, status, plus club metadata (logo,
name, socials, address) and full ladder rows. It does not capture player-level match stats.
For a shared service we want to be self-sufficient (not re-fetch Dribl to answer a query)
without over-collecting data no one uses yet.

## Options

- **Match current depth, promoted to first-class entities (recommended)** — same fields,
  but competition/season/league become real entities rather than name strings.
- **Minimal** — only scores + fixtures. Loses venue, coordinates, club branding; forces
  extra lookups.
- **Maximal (incl. player stats, lineups, events)** — richest, but Dribl coverage is
  inconsistent and it's out of scope for v1 features.

## Recommendation

**Self-sufficient, current depth + first-class competition entities.** Capture:

- **Fixture**: date, time, round, venue, coordinates, status, home/away scores, bye flag.
- **Club**: name, display name, logo, email, website, address, socials.
- **Team**: name, age group, gender, competition membership.
- **Competition/Season/League**: as entities with IDs (not just names).
- **Ladder**: full rows (position, played, W/D/L, GF/GA/GD, points).

Defer player-level match stats to a later ADR.

## Consequences

- Schema models competition/season/league explicitly — enables 0006's relational joins.
- Slightly more transform work than today's flat records.
- Player stats can be added later without reworking core entities.
