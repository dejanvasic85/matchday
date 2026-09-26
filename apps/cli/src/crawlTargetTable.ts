// Terminal rendering for `mday crawl-target list` — presentation only, so `--json` prints the
// service's shape untouched.

import type { CrawlTargetSummary } from "#services/crawlTargetService.ts";
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
