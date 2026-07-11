# 0007. API style

- Status: proposed
- Date: 2026-07-12

## Context

matchday serves read-mostly competition data with a well-defined, stable resource set:
clubs, teams, competitions, seasons, fixtures, ladder tables. Consumers (starting with
williamstownsc's Next.js app) need predictable, cacheable responses. The API sits behind
Cloudflare for edge caching.

## Options

- **REST + OpenAPI (recommended)** — resource endpoints, typed via an OpenAPI spec.
  - Pros: simple, cacheable at the edge by URL, easy to consume from Next.js, generates
    typed clients; fits known-shape data.
  - Cons: over/under-fetching on complex nested reads (rare here).
- **GraphQL** — single endpoint, client-shaped queries.
  - Pros: flexible nested fetching.
  - Cons: edge caching is harder (POST/query-hash); overkill for a small, stable schema;
    more server complexity.

## Recommendation

**REST with an OpenAPI spec.** Resource-oriented endpoints (e.g.
`/clubs/{id}`, `/teams/{id}/fixtures`, `/competitions/{id}/table`), typed client generated
from the spec. Cache aggressively at Cloudflare with sensible TTLs per resource.

## Consequences

- OpenAPI spec is the API contract; generate consumer types from it.
- Edge caching keyed on URL — align cache TTLs with scrape cadence (0003).
- Revisit GraphQL only if consumers need highly variable nested queries later.
