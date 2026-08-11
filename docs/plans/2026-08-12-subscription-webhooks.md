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
- After a league's deep crawl, every _active_ subscription on that league with a webhook fires a
  POST carrying `leagueId`, a `hasChanges` boolean, and a crawl timestamp — every run, not only
  on change, so the client owns the revalidation decision.
- Change detection compares the league's fixtures + table before vs after the crawl. No such
  comparison exists today; build it as a small pure function over the two existing read queries
  (`listFixturesByLeagueId`, `listTableEntriesByLeagueId`), not crawler-internal state.
- Webhook delivery is best-effort and **must never fail the deep crawl job** — one bad URL logs
  and moves on, it doesn't block other subscribers or the crawl's own success/failure.
- CLI-managed, per ADR 0014 (`mday` is the admin surface, not a new interface).

Decided without a formal ADR (small enough surface, one operator):

- **Signing: yes, HMAC-SHA256.** Each subscription gets a `webhook_secret`, generated like an API
  token (0013 pattern) and shown once on `set-webhook`. Every delivery carries
  `X-Matchday-Signature: sha256=<hex hmac of the raw body>` so a receiver can verify it actually
  came from us. Cheap to add (a few lines, mirrors `apiTokenHash.ts`) and avoids an obvious spoof
  vector for anyone who guesses a client's webhook URL.
- **Retries: none for v1.** Single attempt, short timeout (5s), log and move on. Matches this
  repo's "keep it simple until proven otherwise" bias — add a queue/backoff only if delivery
  reliability turns out to matter in practice.
- **Per-subscription, not per-client.** Keeps a client free to point different leagues at
  different endpoints; a client that only needs one just sets the same URL on each subscription.

## Todo

1. **Schema + domain.** Migration: `client_subscription.webhook_url` + `webhook_secret` (both
   nullable text). Extend `subscriptionSchema` (domain). Add a domain webhook-signing helper
   (`generateWebhookSecret` / `signWebhookPayload`, mirroring `apiTokenHash.ts`'s Web Crypto
   style). Extend `subscriptionDb.ts` with `setSubscriptionWebhook` (by subscription id) and
   `listActiveSubscriptionsForLeagueWithWebhook(leagueId)` — kept separate from
   `upsertSubscription` so re-subscribing (`add-subscription`) never silently wipes an
   already-configured webhook.
2. **Change-detection service.** Pure comparison function (before/after fixture + table arrays →
   `{ hasChanges, fixturesChanged, tableChanged }`). No DB/network — unit tests only, covering:
   no change, a score/status change, a table position change, a new fixture appearing.
3. **Webhook notification service.** Builds the signed payload, sends via an injected
   `sendWebhook` collaborator (DI, per AGENTS.md — services stay pure and testable with a fake
   sender). Each subscription's send is isolated: one failure is logged and doesn't stop the rest.
4. **CLI: webhook management.** `mday client set-webhook <sub_id> --url <url>` (mints + prints the
   secret once, like `create-token`) and `mday client clear-webhook <sub_id>`. `client list` grows
   a webhook-configured indicator (never prints the secret again).
5. **Wire into `deepCrawl` job.** Snapshot fixtures+table for the league before crawling, run the
   existing crawl unchanged, snapshot again after, diff, look up that league's
   webhook-subscriptions, notify. Transport glue only (AGENTS.md) — orchestration stays in the
   services from slices 2–3.

Each slice: implement + tests, `caveman-review` on the diff, PR referencing #105 (`Closes #105` on
the last slice), ticking off this list as slices land — per AGENTS.md's slice workflow.

## Open questions

- **Per-subscription vs per-client webhook.** Assuming per-subscription (see decision above). If
  in practice one URL per client is all that's ever needed, the field could move to `client`
  instead — worth a sanity check with whoever integrates first (williamstownsc).
- **Payload richness.** Starting minimal (`leagueId`, `hasChanges`, `crawledAt`). A `summary`
  (e.g. `fixturesChanged` count) was considered but dropped from v1 scope — add only if a real
  consumer asks, per AGENTS.md's no-speculative-abstraction guidance.
