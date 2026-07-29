# matchday — roadmap

**The build backlog now lives in [GitHub Issues](https://github.com/dejanvasic85/matchday/issues).**

This file is no longer the source of truth for outstanding work. Pick up work from the issue
list instead — issues carry the same phase/ADR context this file used to hold:

- **Milestones** group work by phase: [Phase 3 — Scraper](https://github.com/dejanvasic85/matchday/milestone/1),
  [Phase 4 — API](https://github.com/dejanvasic85/matchday/milestone/2),
  [Phase 5 — WSC migration](https://github.com/dejanvasic85/matchday/milestone/3).
- **`phase:N` labels** mirror the milestones for filtering.
- **`adr:NNNN` labels** link an issue to the decision(s) it implements.
- **`question` label** holds the open questions / later-consideration items that used to sit at
  the bottom of this file.

Phases 0–2 (foundations, data model & schema, domain) and all of Phase 3 except scheduling were
complete when the backlog moved on 2026-07-29; that history lives in this file's git log rather
than as closed issues.

The **ADRs in [docs/decisions](decisions/README.md) remain the source of truth** for decisions —
read the relevant one before a change.

**Guiding principle:** hold a very high standard throughout — clean, maintainable code and a
project that stays easy to reason about. Prefer small, well-named functions over cleverness; no
dead code or speculative abstraction; strong types and tests. Every phase is judged on
maintainability, not just "it works".
