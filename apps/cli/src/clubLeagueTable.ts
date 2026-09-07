// Terminal rendering for `mday club leagues` — presentation only, kept out of the service so the
// shape stays independent of how it's displayed (and `--json` prints it untouched).

import type { ClubLeagues } from "#services/clubLeagueService.ts";
import { renderTable } from "#terminalTable.ts";

export function renderClubLeagueTable(clubLeagues: ClubLeagues): string {
  const { club, leagues } = clubLeagues;
  const header = `${club.name} (${club.id})`;

  if (leagues.length === 0) {
    return (
      `${header}\n` +
      "No leagues found — the league crawl hasn't run for any of this club's leagues yet."
    );
  }

  const table = renderTable(
    ["LEAGUE ID", "NAME"],
    leagues.map((league) => [league.id, league.name]),
  );

  return `${header}\n${table}`;
}
