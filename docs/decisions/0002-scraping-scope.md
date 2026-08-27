# 0002. Scraping scope

- Status: superseded
- Date: 2026-07-12
- Superseded by: [0012](0012-subscription-multisource.md) — subscriptions drive the crawl scope,
  not a hand-seeded tracked-competition registry.

## Context

The crawler in `williamstownsc` (WSC) works **per team**. It walks each enabled team, matches
Dribl season, competition and league IDs by name, then crawls that team's fixtures round by
round. When two teams share a competition, it fetches the same fixtures twice. Across a
multi-tenant service onboarding many clubs, that multiplies both wasted fetches and load on
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

### Key insight: keying the crawl on competition removes duplicates

Scraping the same fixture twice is an artefact of the _per-team_ model. Key the crawl on
**competition** instead, and it fetches each fixture and table **exactly once**, however many
tenant teams sit in that competition. So we need no separate de-duplication step: it falls out
of the crawl key. That makes competition-keyed crawling the right base however wide we cast the
net.

One question stays open: _which_ competitions to crawl — only our tenants', or a whole
association. Crawl cost decides that, and we have not measured it yet. Cost depends on the 0003
cadence and on how expensive the Cloudflare-bypass browser step turns out to be.

## Recommendation

**Crawl by competition, driven by a tracked-competitions registry, seeded from tenant teams.**

- The crawler walks a **registry of tracked competitions** and fetches each fixture and table
  once. Per-club and per-team views build on top of that.
- Seed the registry from the competitions our registered tenant teams play in, so we scrape only
  what we serve today.
- The registry is just a list. Widening it to a **whole association** later is a config change,
  not a redesign, so we can defer that call until we have measured real crawl cost.

## Consequences

- The crawler keys on competition, not team. That changes the current per-team loop, and it
  removes duplicates for free.
- We need a `tracked_competition` registry. We populate it by resolving tenant teams to their
  competitions.
- Onboarding a club adds only its _new_ competitions to the registry.
- Scraping a whole association stays open without a redesign. Efficiency gates that decision.
- Cross-club and full-table queries become straightforward.
