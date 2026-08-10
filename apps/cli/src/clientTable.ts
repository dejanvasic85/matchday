// Terminal rendering for `mday client list` — presentation only, kept out of the service so the
// roster shape stays independent of how it's displayed (and `--json` prints it untouched).

import type { ClientSummary } from "./services/clientService.ts";

const columnGap = "  ";
const emptyCell = "-";

function padRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
    .join(columnGap)
    .trimEnd();
}

/** One line per subscription so ids stay copy-pasteable into `client remove-subscription`; a
 * client's id/name/token count is printed on its first line only, blank on continuation lines. */
function toRows(clients: ClientSummary[]): string[][] {
  return clients.flatMap((client) => {
    const summary = [client.id, client.name, String(client.activeTokenCount)];
    if (client.subscriptions.length === 0) {
      return [[...summary, emptyCell, emptyCell]];
    }
    return client.subscriptions.map((subscription, index) =>
      index === 0
        ? [...summary, subscription.id, subscription.leagueName]
        : ["", "", "", subscription.id, subscription.leagueName],
    );
  });
}

export function renderClientTable(clients: ClientSummary[]): string {
  if (clients.length === 0) {
    return 'No clients yet — create one with "mday client add <name>".';
  }

  const header = ["CLIENT ID", "NAME", "TOKENS", "SUBSCRIPTION ID", "LEAGUE"];
  const rows = [header, ...toRows(clients)];
  const widths = header.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );

  return rows.map((row) => padRow(row, widths)).join("\n");
}
