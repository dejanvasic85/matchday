# Subscription webhooks

- Issue: #105
- Branch: `feat/subscription-webhooks`

## Purpose

Today the deep crawl (ADR 0012) writes fixtures/tables to Postgres and stops — a subscribed
client (e.g. williamstownsc) only sees new data once it re-fetches from the API on its own
schedule. Give each `client_subscription` an optional webhook so the crawler can push a
"this league just crawled, here's whether anything changed" notification, letting the client
revalidate its cache on demand instead of polling.

## Requirements

- `client_subscription` gains an optional webhook URL (+ secret, if slice 1 decides to sign
  deliveries). Unset by default — existing subscriptions are unaffected.
- After a league's deep crawl, every *active* subscription on that league with a webhook fires a
  POST carrying `leagueId`, a `hasChanges` boolean, and a crawl timestamp — every run, not only
  on change, so the client owns the revalidation decision.
- Change detection compares the league's fixtures + table before vs after the crawl. No such
  comparison exists today; build it as a small pure function over the two existing read queries
  (`listFixturesByLeagueId`, `listTableEntriesByLeagueId`), not crawler-internal state.
- Webhook delivery is best-effort and **must never fail the deep crawl job** — one bad URL logs
  and moves on, it doesn't block other subscribers or the crawl's own success/failure.
- CLI-managed, per ADR 0014 (`mday` is the admin surface, not a new interface).

## Todo

1. **ADR 0015 — subscription webhooks.** Pin down signing (HMAC over the body with a
   per-subscription secret vs. none for v1) and retry semantics (single attempt + short timeout
   vs. any backoff) before building — this repo writes an ADR for every subscription-shaped
   decision (0012/0013/0014) and this is a new outbound-delivery concept, not a variation on an
   existing one. Blocks slices 2–4 on the signing question specifically.
2. **Schema + domain.** Migration: `client_subscription.webhook_url` (nullable text), plus
   `webhook_secret` if 0015 chooses signing. Extend `subscriptionSchema` (domain) and
   `subscriptionDb.ts`: `upsertSubscription` accepts the new fields, add
   `listActiveSubscriptionsForLeagueWithWebhook(leagueId)`.
3. **Change-detection service.** Pure comparison function (before/after fixture + table arrays →
   `{ hasChanges, fixturesChanged, tableChanged }`). No DB/network — unit tests only, covering:
   no change, a score/status change, a table position change, a new fixture appearing.
4. **Webhook notification service.** Builds the payload (+ signature per 0015), sends via an
   injected `sendWebhook` collaborator (DI, per AGENTS.md — services stay pure and testable with
   a fake sender). Each subscription's send is isolated: one failure is logged and doesn't stop
   the rest.
5. **CLI: webhook management.** `--webhook-url` on `mday client add-subscription`; a
   `set-webhook` / `remove-webhook` (or equivalent unset) path for existing subscriptions. Follows
   existing CLI conventions: `--json`, server-side resolution by client/league name, `--help`
   documents what it writes.
6. **Wire into `deepCrawl` job.** Snapshot fixtures+table for the league before crawling, run the
   existing crawl unchanged, snapshot again after, diff, look up that league's
   webhook-subscriptions, notify. Transport glue only (AGENTS.md) — orchestration stays in the
   services from slices 3–4.

Each slice: implement + tests, `caveman-review` on the diff, PR referencing #105 (`Closes #105` on
the last slice), ticking off this list as slices land — per AGENTS.md's slice workflow.

## Open questions

- **Signing.** Resolve in ADR 0015 before slice 2. Leaning toward HMAC-SHA256 with a
  per-subscription secret (`X-Matchday-Signature` header) for consistency with 0013's per-client
  secret pattern — but that's a recommendation, not yet decided.
- **Retries.** Leaning toward none for v1 (single attempt + short timeout, matching 0013's "keep
  it simple until proven otherwise" for scopes/roles) — confirm in 0015.
- **Per-subscription vs per-client webhook.** The issue and this plan assume per-subscription (a
  client could theoretically want different endpoints per league). If in practice one URL per
  client is all that's ever needed, the field could move to `client` instead — worth a sanity
  check with whoever integrates first (williamstownsc).
- **Payload richness.** Starting minimal (`leagueId`, `hasChanges`, `crawledAt`). A `summary`
  (e.g. `fixturesChanged` count) was considered but dropped from v1 scope — add only if a real
  consumer asks, per AGENTS.md's no-speculative-abstraction guidance.
