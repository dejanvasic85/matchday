# Crawl scope is system configuration

- Date: 2026-09-26

## Purpose

Move the crawl scope out of per-client subscriptions so the system owns which leagues we crawl. A
second source with no client can then be crawled, and a season rollover needs no reconciliation
command. The decision is recorded in the crawl-scope ADR under `docs/decisions/`.

## Requirements

- A `crawl_target` table `(competition, league name)`, unique on the pair, with its own id prefix.
- Targets are managed from the CLI: `mday crawl-target add|list|remove`, with `--json` on list.
- The crawl reads targets. A target resolves to the current season's league by name, and warns when
  there is no match.
- A follow never changes the scope. It only decides who we notify.
- Existing subscriptions are backfilled into targets.
- The subscription table, entity, data access, services, jobs and four commands are removed.

## Plan

Each slice is its own pull request, green before the next. The decision record lands with slice 1.

### Slice 1 — the target table and its data (ADR included)

- [x] Domain: a `crawlTarget` entity and its id prefix.
- [x] DB schema: `crawl_target`, unique on `(competition_id, league_name)`, foreign key to
      `competition`.
- [x] Migration: create the table, then backfill one target per distinct league with an active
      subscription.
- [x] Data access: `crawlTargetDb.ts` with list, upsert and remove.
- [x] Unit test for the entity schema. The migration and backfill are verified against the worktree
      database: the row count matches the distinct active-subscription leagues, and re-running the
      insert adds nothing.

### Slice 2 — manage targets from the CLI

- [x] `mday crawl-target add --competition <name> --league <name>`: resolve the competition by name,
      require the league name to exist under it, then upsert. Storing the real name keeps the crawl's
      later lookup exact.
- [x] `mday crawl-target list [--json]`: show each target's id, competition and league.
- [x] `mday crawl-target remove`: remove by the competition-and-league pair, or by `--id`.
- [x] An ambiguous competition name fails listing the candidates.

### Slice 3 — the crawl reads targets

- [x] `subscribed-leagues` returns the current season's league id for each target, resolved by
      competition and league name. The command name is unchanged, so the workflow still works.
- [x] A target with no league to crawl is warn-logged (stderr) and skipped, leaving the workflow's
      parsed stdout line clean.
- [x] Tests cover a target with a matching league and one without.

### Slice 4 — notification stops using subscriptions

- [ ] Post-crawl notification targets every webhook-configured follow whose club plays in the
      crawled league.
- [ ] Remove the subscription lookup and its join from the notifier.
- [ ] Update the notifier tests.

### Slice 5 — remove the subscription model

- [ ] Drop `client_subscription` (migration), the `subscription` entity and its id prefix.
- [ ] Delete `subscriptionDb.ts`, `subscriptionService.ts`, `subscriptionSyncService.ts`, their jobs
      and tests.
- [ ] Delete the commands `client add-subscription`, `client remove-subscription`,
      `client sync-subscriptions` and `client list-subscriptions`.
- [ ] Update `client list` to drop the subscription column, and reword the follow help that points
      at `sync-subscriptions`.
- [ ] Reword the API service comments that say subscriptions decide which leagues get crawled.
- [ ] Update the README commands.

## Open questions

- `unfollow-club` currently relies on `sync-subscriptions` to prune the followed club's leagues.
  Once the subscription is gone, unfollowing only drops notification interest, so its help needs a
  new wording.
