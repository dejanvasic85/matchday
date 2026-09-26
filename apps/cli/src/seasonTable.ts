// Terminal rendering for `mday season list` — presentation only, so `--json` prints the
// service's shape untouched.

import type { SeasonWindowSummary } from "#services/seasonService.ts";
import { renderTable } from "#terminalTable.ts";

/** "unset" rather than a blank cell: a window without dates is the thing the operator is looking
 * for before a sync, so it should be unmistakable. */
function dateCell(value: string | null): string {
  return value ?? "unset";
}

export function renderSeasonTable(windows: SeasonWindowSummary[]): string {
  if (windows.length === 0) {
    return "No season windows yet — run `mday catalog` first.";
  }
  return renderTable(
    ["SOURCE", "SEASON", "COMPETITION", "STARTS", "ENDS"],
    windows.map((window) => [
      window.source,
      window.seasonName,
      window.competitionName,
      dateCell(window.startsOn),
      dateCell(window.endsOn),
    ]),
  );
}
