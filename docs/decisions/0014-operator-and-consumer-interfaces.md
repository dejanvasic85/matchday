# 0014. Operator and consumer interfaces (CLI vs MCP)

- Status: proposed
- Date: 2026-08-10

## Context

Two distinct audiences need to reach matchday's data, and they have been getting conflated.

**Operators** (today: one person, the maintainer) run administration: onboard a client, subscribe
it to leagues, issue and revoke API tokens, trigger crawls. This is write-heavy, occasionally
destructive, and partly automated — `mday` is already invoked headless by
`.github/workflows/crawl-catalog.yml` and `crawl-deep.yml`.

**Consumers** (today: williamstownsc; later, other clubs) read their own data. This is read-only,
tenant-scoped, and increasingly likely to be reached conversationally — "when is the under-12s'
next game?" — rather than through hand-written HTTP calls.

The question surfaced while building `mday client …` (0013): would an MCP server be a better home
for administration, given an LLM could then drive onboarding? And separately, should clients get an
MCP server to query their data?

Answering both with one interface is tempting and wrong: the audiences differ in blast radius,
in whether a human is present, and in whether the caller may be a language model improvising.

## Options

- **One MCP server for everything** — administration and consumer queries behind one surface.
  - Pros: single thing to build.
  - Cons: puts destructive operations (`revoke-token`, `remove-subscription`) in reach of a model
    acting on a client's behalf; can't run headless in CI, so the crawl workflows still need a CLI;
    tenant scoping and operator scoping collapse into one permission model.
- **CLI for administration, MCP for consumer reads (recommended)** — split by audience.
  - Pros: matches blast radius to interface; keeps CI working (it already depends on `mday`);
    lets the consumer surface be strictly read-only by construction, since it exposes a disjoint
    set of functions.
  - Cons: two transports to maintain — mitigated by both being thin glue over the same services.
- **API-only, no MCP** — consumers use the REST API and generated client (0007).
  - Pros: nothing new to build.
  - Cons: leaves conversational access to each consumer to build themselves; the natural-language
    entry point is exactly what a small club is least equipped to write.

## Recommendation

**Split by audience.**

- **`mday` (CLI) is the administration surface.** Grow it rather than building an admin MCP
  server: client/subscription/token management, crawl invocation, and the read commands needed to
  find ids for those operations (e.g. league search, club→league resolution). It must keep working
  headless, because CI depends on it.
- **An MCP server, when built, is for consumers and is read-only.** It serves a single tenant's
  data for conversational queries. It is **a client of `apps/api`**, not of Postgres directly —
  tenant scoping already lives in the API's bearer-token middleware (0013), and a second
  implementation of that boundary would be a second chance to get it wrong.

Both are **transport** in the AGENTS.md sense: thin glue that constructs real dependencies and
calls a service. Business logic stays in `services/`, returning `Result`. This is why growing the
CLI is not a detour from MCP — it builds the layer an MCP server would sit on.

Read-only is **not** a property the transport gives you for free. It holds only because the MCP
server exposes a disjoint set of service functions from the CLI's. That choice must be explicit
and enforced in the wiring, not assumed.

## Consequences

- Administration features land as `mday` commands by default. Proposing an admin MCP server means
  revisiting this ADR.
- The CLI's audience includes agents, not just humans. Commands should therefore offer
  machine-readable output (`--json`), narrow server-side rather than expecting the caller to
  filter, and be discoverable from `--help`. `mday client list --json` is the pattern.
- Destructive CLI commands should be recoverable or confirmable. This matters more since local
  `.env.local` points at production (no dev database; Neon branching is the intended fix, #84).
- An MCP server is **not** yet scheduled. It is blocked on the API having real resource routes
  (#45) and the auth scheme landing (0013 / #77). Filing it before then would invert the
  dependency.
- 0007 (REST + OpenAPI) is unaffected: the API stays the contract. MCP would be one more generated
  client of it, which is the reason 0007 chose a language-agnostic spec.
