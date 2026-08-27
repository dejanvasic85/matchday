# 0008. Language / runtime

- Status: decided
- Date: 2026-07-12

## Context

The crawler we already have is TypeScript. It uses `playwright-core` to drive real Chrome past
Dribl's Cloudflare, and Zod to transform responses. The work splits in two, and both halves wait
on input and output rather than the processor: scraping does network fetches and browser
automation, and the API does database reads. Almost nothing here is processor-bound.

## Options

- **TypeScript (recommended)** — reuse the crawler, Zod schemas and transforms we have; one
  language across scraper and API; our consumers already write TypeScript in Next.js.
  - Pros: the fastest path, reuses code, needs one toolchain, and has a large ecosystem —
    Playwright, Drizzle and Prisma, OpenAPI.
  - Cons: not the fastest runtime, though scraping and serving both wait on input and output, so
    that rarely matters.
- **Go** — strong concurrency, and deploys as a single binary.
  - Cons: we would rewrite the crawler, Playwright support is weaker, and we reuse nothing.
- **Rust** — the best performance and safety.
  - Cons: the most effort and the slowest to build. Overkill for work that waits on the network.

## Recommendation

**TypeScript.** Speed is not our constraint, because the workload waits on input and output. The
biggest lever is reusing WSC's crawler logic and Zod transforms. One language covers the whole
monorepo — scraper, API and consumers.

## Consequences

- We reuse the `playwright-core` and Zod patterns from williamstownsc.
- A later decision picks a TypeScript database layer and an OpenAPI-friendly framework.
- Revisit a compiled language only if a specific hot path turns out to be processor-bound.
