# 0002. Scraping scope

- Status: proposed
- Date: 2026-07-12

## Context

The current WSC crawler is **per-team**: it iterates each enabled team, resolves Dribl
season/competition/league IDs by name, and crawls that team's fixtures round-by-round. When
teams share a competition, the same fixtures get fetched multiple times. For a multi-tenant
service onboarding many clubs, per-team crawling multiplies redundant fetches and load on
Dribl.

## Options

- **Scrape per competition/league (recommended)** — crawl every fixture in a competition
  once, then derive each team's and club's view from that shared dataset.
  - Pros: no duplicate fetches; a fixture is stored once; onboarding a club that plays in an
    already-tracked competition is free.
  - Cons: need to know which competitions to track; must map teams→competitions.
- **Scrape per club** — crawl only the competitions a given tenant club plays in.
  - Pros: scrape only what's needed; smaller footprint early.
  - Cons: overlapping competitions re-fetched per club; harder to serve cross-club queries.
- **Scrape everything on Dribl** — crawl all competitions regardless of tenants.
  - Pros: complete dataset, instant onboarding.
  - Cons: large, wasteful, most data never served; heavier Dribl load.

## Recommendation

**Scrape by competition/league**, driven by the set of competitions any tenant participates
in. Store all fixtures once per competition; expose per-club and per-team views on top.
Onboarding a new club adds only its *new* competitions to the crawl set.

## Consequences

- Crawler keyed on competition, not team — a shift from the current per-team loop.
- Need a registry of tracked competitions (derived from tenant clubs' teams).
- Enables cross-club and full-ladder queries naturally.
