---
name: task-finish
description: Finish a task after its pull request is merged. Confirms the merge, stops anything running from the worktree, then removes the worktree, its local git branch, and its Neon database branch. Use when the user says "/task-finish", "clean up the worktree", "the PR is merged", or asks to reclaim a branch's database.
---

# Finish a task

Tears down what `/task-start` set up: the git worktree, its local branch, and its Neon branch. It
is destructive, so it checks the merge first and refuses anything that is not this machine's to
remove. Run it from the main checkout, never from inside the worktree being removed.

## Inputs

- A branch name (`issue-141`) or an issue number, which becomes `issue-<number>`.
- Optional `--force` to drop a worktree with uncommitted changes and delete an unmerged branch.
- Optional `--no-db` to keep the Neon branch.
- Optional `--dry-run` to print what would happen.

## Steps

1. Confirm the pull request is merged before removing anything:

   ```bash
   gh pr list --head <branch> --state merged --json number,mergedAt
   ```

   Stop when the list is empty. Nothing is removed for an open, closed, or missing pull request.
   Ask the user how to proceed if the branch never had one.

2. Stop anything long-running you started inside the worktree — a dev server, a crawl, a watch
   process — and close any browser sessions opened against it. A removed worktree leaves a process
   pointing at a path that is gone.

3. Remove the worktree, the local branch, prune the remote ref, and reclaim the Neon branch:

   ```bash
   vp run wt:remove <branch> [--force] [--no-db] [--dry-run]
   ```

   It refuses another machine's branch, `production`, `main`, and any `pr-*` branch. The final
   `vp run db:branch:clean` sweeps any other stale branches of this machine.

4. Reclaim the Neon branch when the CLI cannot. If `neon` is not authenticated
   (`neon profile list` shows no account), step 3 cannot delete the branch. Delete it through a
   Neon MCP server when one is configured, choosing only the branch named `<machine>/<branch>`.
   Never delete any other name.

## Notes

- `vp run db:branch:clean` only reclaims `<machine>/<branch>` names whose git branch has gone, so
  it never touches another machine's branches.
- Every branch expires on its own after 7 days, so a missed cleanup is not a leak, only a tidier
  sooner.
- The worktree sits beside the main checkout as `../<repo>-<branch>`; step 3 prints the exact path.
