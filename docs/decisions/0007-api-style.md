# 0007. API style

- Status: decided
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

**REST with an OpenAPI spec as the contract.** Resource-oriented endpoints (e.g.
`/clubs/{id}`, `/teams/{id}/fixtures`, `/competitions/{id}/table`). Consumers — starting with
WSC's Next.js app — **generate typed clients from the OpenAPI spec**, giving end-to-end type
safety while staying language-agnostic for any future non-TS or third-party consumer. Cache
aggressively at Cloudflare with per-resource TTLs.

tRPC and a shared-types package were considered but rejected: both assume a TS-only world and
lack a language-agnostic contract / auto-generated docs suited to a multi-tenant public API.

## Consequences

- OpenAPI spec is the API contract; generate consumer types from it.
- Edge caching keyed on URL — align cache TTLs with scrape cadence (0003).
- Revisit GraphQL only if consumers need highly variable nested queries later.
