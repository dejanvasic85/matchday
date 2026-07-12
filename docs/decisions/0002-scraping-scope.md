# 0002. Scraping scope

- Status: decided
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

### Key insight: competition-keyed crawling solves dedup

The "same fixture/result scraped multiple times" problem is an artefact of the _per-team_
model. If the crawl is **keyed on competition**, each fixture and ladder is fetched **exactly
once** no matter how many tenant teams sit in that competition. Dedup is therefore not a
separate mechanism — it falls out of the crawl key. This makes competition-keyed crawling the
right base regardless of how wide we cast the net.

That leaves one open axis: _which_ competitions to crawl — only tenants' competitions, or a
whole association. That choice is driven by **crawl efficiency/cost** (0003 cadence + how heavy
the Cloudflare-bypass browser step is), which we haven't measured yet.

## Recommendation

**Crawl by competition, driven by a tracked-competitions registry, seeded from tenant teams.**

- The crawler iterates a **registry of tracked competitions**, fetching each fixture/ladder
  once; per-club and per-team views are derived on top.
- Seed the registry from the competitions that registered tenant teams play in (lean — scrape
  only what's served today).
- The registry is just a list, so widening to a **whole association** later is a config change,
  not a rearchitecture. Defer that call until real crawl cost is measured.

## Consequences

- Crawler keyed on competition, not team — a shift from the current per-team loop; dedup is
  intrinsic.
- Need a `tracked_competition` registry, initially populated by resolving tenant teams →
  competitions.
- Onboarding a club adds only its _new_ competitions to the registry.
- Path to whole-association scraping is open without redesign; decision gated on efficiency.
- Enables cross-club and full-ladder queries naturally.
