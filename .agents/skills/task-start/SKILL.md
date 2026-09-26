---
name: task-start
description: Start work on an issue or branch. Reads the work first, then creates the git worktree and its own Neon database branch for it. Use when the user says "/task-start", "start a new task", "set up a worktree for an issue", or starts work on an issue or branch.
---

# Start a task

Sets up an isolated place to work: a git worktree beside the main checkout, plus its own
copy-on-write Neon branch. Run the setup from the main checkout, never from inside a worktree.

## Inputs

- An issue number (`140`) or a branch name (`fix/squad-numbers`).
- Optional `--days <n>` for the Neon branch expiry, capped at 7.

Derive the branch name as `issue-<number>` for an issue, slugged, unless the user gives a name.

## Steps

1. Read the issue or the request before creating anything. Note what the task touches, so you know
   which checks to run and whether it needs a database at all.

2. Create the worktree and its branch, from the main checkout:

   ```bash
   vp run wt <branch>
   ```

   This creates `../<repo>-<branch>` from `origin/main`, creates the Neon branch
   `<machine>/<branch>`, writes a real `.env` with its own `DATABASE_URL`, installs, builds
   `packages/*`, and migrates. It refuses to run when the worktree already exists.

3. Work from inside the worktree. It has its own database, so writes there never touch
   production.

4. Report the worktree path and the Neon branch name. Both are printed by step 2.

## Notes

- One database per (machine, branch): `vp run wt <branch>` refuses a branch it already prepared,
  and `vp run db:branch` resets that branch's database rather than duplicating it.
- Machines are isolated automatically. Set `MATCHDAY_MACHINE` when the detected name would collide
  with another machine's.
- Branches expire on their own after 7 days, so a forgotten worktree is not a leak.
- Tear it down with `/task-finish` or `vp run wt:remove <branch>`.
