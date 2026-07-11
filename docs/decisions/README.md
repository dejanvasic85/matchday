# Architecture Decision Records

Lightweight ADRs tracking direction for `matchday`. Each records the context, the options
considered, the recommendation, and the consequences. Status is `proposed` until confirmed,
then `decided`.

| #    | Decision                          | Status   | Summary of recommendation                                  |
| ---- | --------------------------------- | -------- | ---------------------------------------------------------- |
| 0001 | [Naming](0001-naming.md)          | decided  | `matchday`, single monorepo (scraper + API + infra)        |
| 0002 | [Scraping scope](0002-scraping-scope.md)     | decided  | Crawl by competition (dedup intrinsic); registry seeded from tenants, scales to whole association |
| 0003 | [Scraping cadence](0003-scraping-cadence.md) | decided  | Two jobs: clubs daily; competition crawl fixture-derived (30-min match window, daily, weekly off-season) |
| 0004 | [Scraping depth](0004-scraping-depth.md)     | decided  | Self-sufficient fixture + club + ladder; logos self-hosted on R2; no player stats v1 |
| 0005 | [Identifiers](0005-identifiers.md)           | decided  | Prefixed-nanoid own IDs (`clb_…`) + external Dribl ref mapping |
| 0006 | [Datastore](0006-datastore.md)               | decided  | Relational Postgres                                        |
| 0007 | [API style](0007-api-style.md)               | proposed | REST with OpenAPI                                          |
| 0008 | [Language / runtime](0008-language-runtime.md) | proposed | TypeScript                                               |
| 0009 | [Hosting](0009-hosting.md)                    | proposed | Postgres (Supabase/Vercel) + scheduled scraper + Vercel API + Cloudflare edge |
| 0010 | [Monorepo tooling](0010-monorepo-tooling.md) | proposed | pnpm workspaces + Turborepo; apps/ + packages/ layout    |

## Format

Each ADR follows:

```markdown
# NNNN. Title

- Status: proposed | decided
- Date: YYYY-MM-DD

## Context
## Options
## Recommendation
## Consequences
```
