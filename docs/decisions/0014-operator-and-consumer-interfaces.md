# 0014. Operator and consumer interfaces (CLI vs MCP)

- Status: proposed
- Date: 2026-08-10

## Context

Two different audiences reach matchday's data, and we have been conflating them.

**Operators** — today just the maintainer — run administration: onboard a client, subscribe it to
leagues, issue and revoke API tokens, and trigger crawls. This work writes a lot, occasionally
destroys something, and runs partly unattended. `.github/workflows/crawl-catalog.yml` and
`crawl-leagues.yml` already invoke `mday` headless.

**Consumers** — today williamstownsc, later other clubs — read their own data. This work is read
only, scoped to one tenant, and increasingly likely to arrive as a conversation ("when is the
under-12s' next game?") rather than as HTTP calls somebody wrote by hand.

The question came up while we built `mday client …` for 0013. Would a Model Context Protocol (MCP)
server be a better home for administration, since a language model could then drive onboarding?
And separately, should clients get an MCP server to query their own data?

Answering both with one interface is tempting and wrong. The two audiences differ in how much
damage a mistake does, in whether a human is watching, and in whether the caller might be a
language model improvising.

## Options

- **One MCP server for everything** — administration and consumer queries behind a single surface.
  - Pros: only one thing to build.
  - Cons: it puts destructive operations such as `revoke-token` and `remove-subscription` within
    reach of a model acting for a client. It cannot run headless in CI, so the crawl workflows
    would still need a CLI. And tenant scoping and operator scoping collapse into one permission
    model.
- **A CLI for administration, MCP for consumer reads (recommended)** — split by audience.
  - Pros: it matches each interface to how much damage it can do. CI keeps working, since it
    already depends on `mday`. And the consumer surface is read-only by construction, because it
    exposes a disjoint set of functions.
  - Cons: we maintain two transports. Both are thin glue over the same services, which limits the
    cost.
- **The API alone, with no MCP** — consumers use the REST API and the generated client from 0007.
  - Pros: nothing new to build.
  - Cons: every consumer then builds conversational access themselves. A natural-language entry
    point is exactly what a small club is least equipped to write.

## Recommendation

**Split by audience.**

- **`mday`, the CLI, is the administration surface.** Grow it instead of building an admin MCP
  server. It manages clients, subscriptions and tokens, invokes crawls, and offers the read
  commands you need to find ids for those operations — searching leagues, or resolving a club to
  its leagues. It must keep working headless, because CI depends on it.
- **An MCP server, when we build one, serves consumers and is read-only.** It serves a single
  tenant's data for conversational queries, and it is **a client of `apps/api`** rather than of
  Postgres. Tenant scoping already lives in the API's bearer-token middleware (0013), and
  implementing that boundary twice would give us two chances to get it wrong.

Both are **transport** in the AGENTS.md sense: thin glue that builds the real dependencies and
calls a service. Business logic stays in `services/` and returns a `Result`. That is why growing
the CLI is not a detour away from MCP — it builds the layer an MCP server would sit on.

Read-only is **not** something the transport gives you for free. It holds only because the MCP
server exposes a different set of service functions from the CLI's. Make that choice explicit and
enforce it in the wiring; never assume it.

## Consequences

- Administration features land as `mday` commands by default. To propose an admin MCP server,
  revisit this ADR.
- The CLI's audience includes agents, not only humans. So every command should print
  machine-readable output with `--json`, narrow results on the server rather than expecting the
  caller to filter a full dump, and describe itself in `--help`. `mday client list --json` is the
  pattern to follow.
- Make destructive CLI commands recoverable, or make them ask first. This matters more because
  `.env.local` points at production: we have no dev database, and Neon branching is the intended
  fix (#84).
- We have **not** scheduled an MCP server. It is blocked on the API gaining real resource routes
  (#45) and on the auth scheme landing (0013, #77). Filing it earlier would invert that
  dependency.
- This leaves 0007 untouched. The REST API and its OpenAPI spec stay the contract, and an MCP
  server would be one more generated client of it — which is why 0007 chose a language-agnostic
  spec in the first place.
