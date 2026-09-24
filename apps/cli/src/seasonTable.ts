// Terminal rendering for `mday season list` — presentation only, so `--json` prints the
// service's shape untouched.

import type { SeasonSummary } from "#services/seasonService.ts";
import { renderTable } from "#terminalTable.ts";

/** "unset" rather than a blank cell: a season without dates is the thing the operator is looking
 * for before a sync, so it should be unmistakable. */
function dateCell(value: string | null): string {
  return value ?? "unset";
}

export function renderSeasonTable(seasons: SeasonSummary[]): string {
  if (seasons.length === 0) {
    return "No seasons yet — run `mday catalog` first.";
  }
  return renderTable(
    ["SEASON ID", "NAME", "STARTS", "ENDS"],
    seasons.map((season) => [
      season.id,
      season.name,
      dateCell(season.startsOn),
      dateCell(season.endsOn),
    ]),
  );
}
