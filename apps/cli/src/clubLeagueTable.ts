// Terminal rendering for `mday club leagues` — presentation only, kept out of the service so the
// shape stays independent of how it's displayed (and `--json` prints it untouched).

import type { ClubLeagues } from "./services/clubLeagueService.ts";

const columnGap = "  ";

function padRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
    .join(columnGap)
    .trimEnd();
}

export function renderClubLeagueTable(clubLeagues: ClubLeagues): string {
  const { club, leagues } = clubLeagues;
  const header = `${club.name} (${club.id})`;

  if (leagues.length === 0) {
    return (
      `${header}\n` +
      "No leagues found — the deep crawl hasn't run for any of this club's leagues yet."
    );
  }

  const columns = ["LEAGUE ID", "NAME"];
  const rows = [columns, ...leagues.map((league) => [league.id, league.name])];
  const widths = columns.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );

  return [header, ...rows.map((row) => padRow(row, widths))].join("\n");
}
