# 0017. Clients follow clubs and request crawl targets through the API

- Status: decided
- Date: 2026-10-15
- Reshapes: 0014 (operator and consumer interfaces), 0016 (crawl scope)

## Context

stadly has four clubs in production. Onboarding each one takes three manual `mday` commands:
`client follow-club`, `client set-webhook` and `crawl-target add`. Then someone copies the webhook
secret across to stadly by hand.

stadly already knows when a club links to matchday, so it could do this itself. It can't, because:

- **The API is read only.** 0014 made `mday` the only administration surface and kept consumers to
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

### A client cannot remove a target

Another client may rely on the same league. Removing a target stays an admin task in `mday`.

### The client comes from the token

Every write uses the client from the bearer token. The request body never names a client, so one
client cannot follow a club or rotate a secret for another.

### Following sets the webhook in the same call

`PUT /clubs/{id}/follow` takes the webhook URL. It creates the follow if needed, then sets the
webhook with a fresh secret. The response shows the secret once. Calling it again rotates the
secret, as `mday client set-webhook` does today.

## Consequences

- **The API gains a write surface.** It is narrow and scoped to the calling client. 0014's split
  still holds: `mday` stays the admin surface, and any MCP server stays read only.
- **One copy of the logic.** The follow, webhook and crawl-target writes move to a new
  `@matchday/services` package that takes ids. The CLI resolves names to ids and calls it. The API
  calls it with ids from the URL.
- **One atomic write.** Following is a single upsert that sets the webhook in both the insert and
  the conflict branch, so a follow never exists half-configured. The neon-http driver has no
  interactive transaction, so this needs one statement, not two.
- **The SDK grows.** `followClub`, `unfollowClub` and `addLeagueCrawlTarget` ship in a minor
  release.
- **A follow without a webhook stays CLI only.** The API always takes a webhook URL.

## Deferred

- **No cap on targets per client.** Any client can widen the crawl, and each target adds crawl time
  on GitHub Actions. We have one API client, so we log the client on each add and watch it by hand.
  Revisit when a second client can add targets.
- **No record of who asked for a target.** The log line is the only trace. If clients start adding
  targets often, store the requesting client on `crawl_target`.
