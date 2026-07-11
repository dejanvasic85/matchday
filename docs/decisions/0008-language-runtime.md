# 0008. Language / runtime

- Status: decided
- Date: 2026-07-12

## Context

The existing crawler is TypeScript, using `playwright-core` (real Chrome to bypass Dribl's
Cloudflare) and Zod transforms. Work splits into scraping (I/O-bound: network fetches,
browser automation) and an API (I/O-bound DB reads). CPU-bound hot paths are minimal.

## Options

- **TypeScript (recommended)** — reuse existing crawler, Zod schemas, and transforms; one
  language across scraper + API; consumers are already TS (Next.js).
  - Pros: fastest path, code reuse, single toolchain, large ecosystem (Playwright, Prisma/
    Drizzle, OpenAPI).
  - Cons: not the fastest runtime, but scraping/serving is I/O-bound so it rarely matters.
- **Go** — great concurrency and single-binary deploys.
  - Cons: rewrite the crawler; Playwright story weaker; no code reuse.
- **Rust** — top performance/safety.
  - Cons: highest effort, slowest to build; overkill for I/O-bound work.

## Recommendation

**TypeScript.** Efficiency isn't the constraint here — the workload is I/O-bound, and
reusing WSC's crawler logic and Zod transforms is the biggest lever. One language across the
monorepo (scraper, API, and consumers).

## Consequences

- Reuse `playwright-core` + Zod patterns from williamstownsc.
- Pick a TS DB layer (Drizzle/Prisma) and an OpenAPI-friendly framework in a later decision.
- Revisit a compiled language only if a specific hot path proves CPU-bound.
