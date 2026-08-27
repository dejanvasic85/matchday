# Architecture Decision Records

Lightweight architecture decision records (ADRs) tracking direction for `matchday`. Each one
records the context, the options we considered, what we chose, and what follows from it.

**Read the relevant ADR before you change the area it covers.** These records are the source of
truth for direction. Where an ADR and the code disagree, one of them is wrong — say so rather
than quietly following either.

A record is `proposed` until we confirm it, then `decided`. A later record can **supersede** an
earlier one, or **reshape** it (change part of it without replacing it). The superseded record
stays in place, marked, so the history stays readable.

| #    | Decision                                                                   | Status     | What we chose                                                                |
| ---- | -------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| 0001 | [Naming](0001-naming.md)                                                   | decided    | `matchday`; one monorepo for crawler, API and infra                          |
| 0002 | [Scraping scope](0002-scraping-scope.md)                                   | superseded | Crawl by competition, so dedup is intrinsic — replaced by 0012               |
| 0003 | [Scraping cadence](0003-scraping-cadence.md)                               | decided    | Two jobs: clubs daily; competition crawl at a fixture-derived cadence        |
| 0004 | [Scraping depth](0004-scraping-depth.md)                                   | decided    | Self-sufficient fixture, club and table data; logos on R2; no player stats   |
| 0005 | [Identifiers](0005-identifiers.md)                                         | decided    | Our own prefixed-nanoid ids (`clb_…`), plus an external-reference mapping    |
| 0006 | [Datastore](0006-datastore.md)                                             | decided    | Relational Postgres                                                          |
| 0007 | [API style](0007-api-style.md)                                             | decided    | REST and OpenAPI on Hono/Workers; consumers generate typed clients           |
| 0008 | [Language / runtime](0008-language-runtime.md)                             | decided    | TypeScript everywhere                                                        |
| 0009 | [Hosting](0009-hosting.md)                                                 | decided    | Workers, R2 and edge on Cloudflare; Neon Postgres; crawler on GitHub Actions |
| 0010 | [Monorepo tooling](0010-monorepo-tooling.md)                               | decided    | pnpm workspaces plus Vite+ (`vp`); `apps/` and `packages/` layout            |
| 0011 | [Data model & schema](0011-data-model.md)                                  | decided    | The Drizzle schema, prefixed-nanoid keys, polymorphic `external_ref`         |
| 0012 | [Subscriptions & multi-source](0012-subscription-multisource.md)           | decided    | Subscribe a client to a league; split catalog from deep crawl; many sources  |
| 0013 | [API auth](0013-api-auth.md)                                               | proposed   | A `client` entity, with per-client bearer tokens hashed at rest              |
| 0014 | [Operator & consumer interfaces](0014-operator-and-consumer-interfaces.md) | proposed   | `mday` is the admin surface; any future MCP server is read-only              |

## Format

Each ADR follows this shape:

```markdown
# NNNN. Title

- Status: proposed | decided | superseded
- Date: YYYY-MM-DD

## Context

## Options

## Recommendation

## Consequences
```

Write them in plain language, per ISO 24495-1:2023 — see the Communication style section of
`AGENTS.md`. Say what you chose and why in short, active sentences. A reader who was not in the
discussion should be able to act on the record without asking you to explain it.

Do not rewrite the substance of a `decided` record. If the decision changes, add a new ADR that
supersedes or reshapes it, and link the two.
