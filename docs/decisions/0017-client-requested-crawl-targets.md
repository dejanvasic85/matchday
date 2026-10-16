# 0017. Clients follow clubs and request crawl targets through the API

- Status: decided
- Date: 2026-10-15
- Reshapes: 0014 (operator and consumer interfaces), 0016 (crawl scope)

## Context

stadly has four clubs in production. Onboarding each one takes three manual `mday` commands:
`client follow-club`, `client set-webhook` and `crawl-target add`. Then someone copies the webhook
secret across to stadly by hand.

stadly already knows when a club links to matchday, so it could do this itself. It can't, because:

- **The API is read-only.** 0014 made `mday` the only administration surface and kept consumers to
  reads.
- **Only an admin adds a crawl target.** 0016 said a follow never widens the crawl, and an admin
  adds targets on purpose.

The manual steps scale with every club stadly signs up, and the copied secret is one more chance to
get the webhook wrong.

## Options

1. **Keep onboarding in the CLI.** No change, but an admin stays in the loop for every new club.
2. **Let a follow add its club's leagues as targets.** One call, but it brings back the problem
   0016 fixed: scope drifts with whoever signs up, and a follow silently costs crawl time.
3. **Give the API three narrow writes.** A client follows a club (with its webhook), unfollows it,
   and asks for one league to be crawled. Each is a separate, deliberate call.

## Recommendation

Choose option 3.

### A follow still never adds a target

Following a club only records who to notify. It never changes what we crawl, as in 0016.

### A client may add a target on purpose

`PUT /leagues/{id}/crawl-target` adds one league to the crawl scope. It is the same deliberate act
as an admin running `mday crawl-target add`, just made by the client. The target is keyed on the
league's competition and name, as in 0016, so it covers the current edition of that league even
when the id came from a past season.

The response includes `currentLeagueId`: the edition the next crawl will visit, or null when there
is none yet. A null tells the caller the target is not crawled today. That happens between seasons,
before the next edition exists, or when the league was renamed and the old name no longer matches.
We still add the target, so a valid add between seasons is not refused.

### A client cannot remove a target

Another client may rely on the same league. Removing a target stays an admin task in `mday`.

### The client comes from the token

Every write uses the client from the bearer token. The request body never names a client, so one
client cannot follow a club or rotate a secret for another.

### Following sets the webhook in the same call

`POST /clubs/{id}/follow` takes the webhook URL. It creates the follow if needed and sets the
webhook with a fresh secret. The response shows the secret once. Calling it again rotates the
secret, as `mday client set-webhook` does today.

It is `POST`, not `PUT`, because each call has an effect: two identical calls give two different
secrets. The secret in the latest successful response is the live one. A client that times out
calls again and uses the new secret. The SDK never retries a `POST`, so it cannot rotate one behind
the caller's back.

### Webhooks only reach public https hosts

A client now chooses where our crawl runner sends requests, so we limit the destination:

- **https only.** Plain `http` is refused.
- **No internal hosts.** We refuse `localhost`, single-label names such as `intranet`, and every
  IP address, public or not. Listing every private range, across IPv4 and IPv6, is easy to get
  wrong, and a webhook with a public https certificate almost always uses a hostname.
- **Checked twice.** We check when the URL is saved, and again before each delivery, so a URL saved
  before this rule cannot slip through.
- **Names are resolved before delivery.** A hostname can point at an internal address. Before each
  send we look the name up and refuse it if any answer is loopback, private, link-local or
  otherwise internal.
- **No redirects.** Delivery does not follow a redirect, so a public host cannot bounce the request
  to an internal one. A redirect counts as a failed delivery.

The CLI follows the same rules, so the API and `mday` cannot store different kinds of URL.

## Consequences

- **The API gains a write surface.** It is narrow and scoped to the calling client. 0014's split
  still holds: `mday` stays the admin surface, and any MCP server stays read-only.
- **Targets drive every source.** Each source's crawl asks for its own leagues from the same
  targets, so a Coastal league is crawled when a client or an admin adds it as a target.
- **One copy of the logic.** The follow, webhook and crawl-target writes move to a new
  `@matchday/services` package that takes ids. The CLI resolves names to ids and calls it. The API
  calls it with ids from the URL.
- **One atomic write.** Following is a single upsert that sets the webhook in both the insert and
  the conflict branch, so a follow never exists half-configured. The neon-http driver has no
  interactive transaction, so this needs one statement, not two.
- **The SDK grows.** `followClub`, `unfollowClub` and `addLeagueCrawlTarget` ship in a minor
  release.
- **A follow without a webhook stays CLI-only.** The API always takes a webhook URL.
- **Existing webhooks are unaffected.** The one webhook in production uses a public https host.

## Deferred

- **No cap on targets per client.** Any client can widen the crawl, and each target adds crawl time
  on GitHub Actions. We have one API client, so we log the client on each add and watch it by hand.
  Revisit when a second client can add targets.
- **No record of who asked for a target.** The log line is the only trace. If clients start adding
  targets often, store the requesting client on `crawl_target`.
- **No DNS-rebinding defence.** The name is resolved once before the send, and `fetch` resolves it
  again, so the answer can change in between. Only clients holding an admin-issued token can set a
  webhook, and the crawl runs on a short-lived GitHub Actions runner, so we accept that for now.
  Revisit before issuing tokens to clients we don't know, or before moving delivery onto
  long-lived infrastructure.
