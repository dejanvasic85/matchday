---
name: scraper-mday-cli
description: The scraper runs as the `mday` CLI (citty); jobs are subcommands invoked locally and by the scheduler
metadata:
  type: project
---

`apps/scraper` is a **batch job runner**, exposed as the **`mday`** CLI (citty), not a TUI/daemon.
Each job is a subcommand; the same invocation serves local runs and the scheduler (thanos cron /
GH Actions / CF Cron).

- Transport (`cli.ts` + `index.ts` bin) is thin glue: build real deps (browser/DB/R2/logger),
  call a pure DI job service, map `Result` → exit code.
- Jobs live in `apps/scraper/src/jobs/` (pure, dependency-injected, unit-tested with fakes).
- Run locally: `vp run --filter @matchday/scraper mday clubs`. The `mday` npm script uses
  `node --env-file-if-exists=.env.local` (no dotenv dep). Needs Chrome + Neon dev + real R2.
- See `apps/scraper/README.md` for full local-run setup. Related: [[dribl-entity-identity]],
  [[pr-per-slice-workflow]].
