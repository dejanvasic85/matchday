// Terminal rendering for `mday crawl-target list` — presentation only, so `--json` prints the
// service's shape untouched.

import type {
  AddClubCrawlTargetsOutcome,
  CrawlTargetSummary,
} from "#services/crawlTargetService.ts";
import { renderTable } from "#terminalTable.ts";

export function renderCrawlTargetTable(targets: CrawlTargetSummary[]): string {
  if (targets.length === 0) {
    return "No crawl targets yet — add one with `mday crawl-target add`.";
  }
  return renderTable(
    ["ID", "COMPETITION", "LEAGUE"],
    targets.map((target) => [target.id, target.competitionName, target.leagueName]),
  );
}

/** Result of `mday crawl-target add-club`: a summary line, then one row per league so the operator
 * sees exactly what a run changed — or, on a dry run, what it would change. */
export function renderClubCrawlTargetsResult(outcome: AddClubCrawlTargetsOutcome): string {
  const { club, added, alreadyTargeted, dryRun } = outcome;
  const header = `${club.name} (${club.id})`;
  const summary = dryRun
    ? `${header}\nWould add ${added.length} league(s); ${alreadyTargeted.length} already in scope.`
    : `${header}\nAdded ${added.length} league(s); ${alreadyTargeted.length} already in scope.`;

  if (added.length === 0 && alreadyTargeted.length === 0) {
    return `${summary}\nNo leagues found — run \`mday catalog\` for this club's leagues first.`;
  }

  const addedLabel = dryRun ? "would add" : "added";
  const rows = [
    ...added.map((name) => [addedLabel, name.competitionName, name.leagueName]),
    ...alreadyTargeted.map((name) => ["in scope", name.competitionName, name.leagueName]),
  ];
  return `${summary}\n${renderTable(["STATUS", "COMPETITION", "LEAGUE"], rows)}`;
}
