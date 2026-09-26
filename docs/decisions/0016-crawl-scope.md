# 0016. Crawl scope is system configuration

- Status: decided
- Date: 2026-09-26
- Supersedes: 0012 (league subscriptions)
- Reshapes: 0011 (data model)

## Context

0012 made a client's subscription decide what we crawl: `subscribed-leagues` returns the leagues any
client is subscribed to, and that set drives the deep crawl. Later work moved the webhook onto the
follow (`client_club`) and made the current season date-based, so a second source can no longer
prune a Dribl client's subscriptions. The crawl is still keyed on per-client rows, though.

That coupling causes three problems:

- **A second source has no client.** The synthetic league plays all year so other systems have live
  data. Under a client-keyed model it is either never crawled, or crawled only by inventing a
  client for it.
- **Every season rollover needs a reconciliation command.** A subscription points at a
  season-scoped league, so it goes stale the moment the season turns. `client sync-subscriptions`
  exists only to fix that.
- **Scope drifts with whoever signs up.** Onboarding a client can change what the system scrapes.

The subscription does two jobs that pull apart — it scopes the crawl (a system concern, since one
crawl serves every client) and records a client's interest (who we notify). Only the first belongs
to the system.

## Options

1. **Keep client-derived scope.** No new table, but the three problems above remain.
2. **A config file in the repo.** Simple and reviewed in a pull request, but every change needs a
   deploy, and a future admin screen cannot write to it.
3. **A `crawl_target` table, managed by the CLI.** The system owns its crawl scope as data.

## Recommendation

Choose option 3.

### A crawl target names one league, without pinning a season

`crawl_target` holds one row per league we crawl:

- **The competition**, by our internal id. A competition has no season, so this id is the same every
  year.
- **The league name**, as text.

We do not store the league's internal id. A league belongs to one season, so the catalog crawl
creates a new league row when the next season's fixtures appear, and a stored league id would point
at last season forever. The league name repeats between seasons, so at crawl time we resolve the
current season's league by name, and warn when no match exists — a rename then shows up as a missing
target rather than silent wrong data.

### Following a club never widens the crawl

A client's interest stays in `client_club` (the follow) and decides only who we notify. It never
adds a target. An admin adds targets on purpose. The trade-off: following a club whose league is not
a target gives that client no fixtures until an admin adds the league.

### The webhook stays on the follow

`client_club` keeps the webhook URL and secret. After a crawl, we notify every webhook-configured
follow whose club plays in the crawled league. The subscription check disappears, so targeting loses
a join.

### What this removes

- `client_subscription` — the table, the `sub_` id prefix and the `subscription` entity.
- `subscriptionDb.ts`, `subscriptionService.ts`, `subscriptionSyncService.ts` and their tests.
- The commands `client add-subscription`, `client remove-subscription`, `client sync-subscriptions`
  and `client list-subscriptions`.
- The per-league opt-out. `client remove-subscription` was the only way to drop one league a club
  plays in. It has no automatic caller and one manual user, so the target list does not need it.

## Consequences

- **New schema.** A `crawl_target` table `(id, competition_id → competition, league_name)`, unique
  on `(competition_id, league_name)`, with its own id prefix.
- **Backfill.** Seed `crawl_target` from the leagues currently in scope — the distinct leagues with
  an active subscription — so the first crawl after the change covers the same leagues.
- **`subscribed-leagues`** becomes "configured crawl targets". Only its query changes.
- **Notification** targets every webhook-configured follow whose club plays in the league. The
  per-league subscription filter goes.
- **CLI.** `mday crawl-target add|list|remove`, grouped by noun, with `--json` on `list`. `list`
  shows each target's competition and league, so an operator can see what is in scope.
- **Season handling.** The target names a league, not a season. The current season comes from the
  source's dates, so a catalog crawl that creates next year's fixtures does not shift scope.
- **The synthetic source** is registered as a target, so it is crawled with no client attached.

## Deferred

- **No warning when a follow has no crawl target.** With one client, we can watch the gap by hand, so
  we do not build a warning yet. Revisit when we have more clients.
- **Whether a source reuses a league id across seasons is unproven.** Production has one season so
  far. If a source reuses one, we could store the league id and drop the name. We will know when a
  second season appears.
