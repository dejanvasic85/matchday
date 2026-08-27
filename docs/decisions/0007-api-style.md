# 0007. API style

- Status: decided
- Date: 2026-07-12

## Context

matchday serves read-mostly competition data over a stable, well-defined set of resources: clubs,
teams, competitions, seasons, fixtures and tables. Consumers need predictable, cacheable
responses — starting with williamstownsc's Next.js app. The API sits behind Cloudflare, which
caches at the edge.

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

**REST, with an OpenAPI spec as the contract.** Endpoints are resource-oriented, such as
`/clubs/{id}`, `/teams/{id}/fixtures` and `/competitions/{id}/table`. Consumers **generate typed
clients from the spec**, starting with WSC's Next.js app. That gives end-to-end type safety and
still works for a future consumer that does not write TypeScript. Cache aggressively at
Cloudflare, with a time-to-live set per resource.

We considered tRPC and a shared-types package, and rejected both. Each assumes a TypeScript-only
world, and neither gives us the language-agnostic contract and generated docs a multi-tenant
public API needs.

### Framework & runtime

**Hono** on **Cloudflare Workers**, per 0009. Hono is edge-native and runs the same code on
Workers, Bun and Node, so we can reverse the runtime choice later. It also supports OpenAPI
directly through `@hono/zod-openapi`, which means one Zod source drives both the spec and the
request validation. The Worker reaches Postgres through the Neon serverless driver or Cloudflare
Hyperdrive, because a raw TCP `pg` connection does not work from a V8 isolate.

## Consequences

- The OpenAPI spec is the contract. Consumers generate their types from it.
- Cloudflare caches at the edge keyed on URL, so align each cache lifetime with the scrape
  cadence in 0003.
- Revisit GraphQL only if consumers later need highly variable nested queries.
- Hono keeps the runtime reversible, so we can move to Bun or Node if Worker isolate limits bite.
- Use `@hono/zod-openapi`, so the Zod schemas from 0004 and 0005 generate the spec.
