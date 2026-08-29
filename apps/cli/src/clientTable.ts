// Terminal rendering for `mday client list` — presentation only, kept out of the service so the
// roster shape stays independent of how it's displayed (and `--json` prints it untouched).

import type { ClientSummary } from "#services/clientService.ts";

const columnGap = "  ";
const emptyCell = "-";

function padRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
    .join(columnGap)
    .trimEnd();
}

/** Subscriptions counted per season rather than listed: a client holds dozens, and the roster's
 * job is to make a leftover season obvious ("2025: 18") — `client list-subscriptions` is where
 * the individual rows live. */
function subscriptionCell(client: ClientSummary): string {
  const countsBySeason = new Map<string, number>();
  for (const subscription of client.subscriptions) {
    countsBySeason.set(
      subscription.seasonName,
      (countsBySeason.get(subscription.seasonName) ?? 0) + 1,
    );
  }
  if (countsBySeason.size === 0) {
    return emptyCell;
  }
  return [...countsBySeason.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([season, count]) => `${season}: ${count}`)
    .join(", ");
}

/** One line per followed club so the webhook column is per-club; a client's id/name/tokens and
 * subscription summary are printed on its first line only, blank on continuation lines. */
function toRows(clients: ClientSummary[]): string[][] {
  return clients.flatMap((client) => {
    const summary = [client.id, client.name, String(client.activeTokenCount)];
    const subscriptions = subscriptionCell(client);
    if (client.clubs.length === 0) {
      return [[...summary, emptyCell, emptyCell, subscriptions]];
    }
    return client.clubs.map((club, index) =>
      index === 0
        ? [...summary, club.clubName, club.hasWebhook ? "yes" : emptyCell, subscriptions]
        : ["", "", "", club.clubName, club.hasWebhook ? "yes" : emptyCell, ""],
    );
  });
}

export function renderClientTable(clients: ClientSummary[]): string {
  if (clients.length === 0) {
    return 'No clients yet — create one with "mday client add <name>".';
  }

  const header = ["CLIENT ID", "NAME", "TOKENS", "FOLLOWED CLUB", "WEBHOOK", "SUBSCRIPTIONS"];
  const rows = [header, ...toRows(clients)];
  const widths = header.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );

  return rows.map((row) => padRow(row, widths)).join("\n");
}
