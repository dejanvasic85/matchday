// Terminal rendering for `mday client list` — presentation only, kept out of the service so the
// roster shape stays independent of how it's displayed (and `--json` prints it untouched).

import type { ClientSummary } from "#services/clientService.ts";
import { emptyCell, renderTable } from "#terminalTable.ts";

/** Date only, and "never" spelled out: the stamp behind it is written at most hourly, so a time
 * would imply a precision it doesn't have. */
function lastApiUseCell(client: ClientSummary): string {
  return client.lastApiUseAt === null
    ? "never"
    : client.lastApiUseAt.toISOString().slice(0, "yyyy-mm-dd".length);
}

/** One line per followed club so the webhook column is per-club; a client's id/name/tokens are
 * printed on its first line only, blank on continuation lines. */
function toRows(clients: ClientSummary[]): string[][] {
  return clients.flatMap((client) => {
    const summary = [
      client.id,
      client.name,
      String(client.activeTokenCount),
      lastApiUseCell(client),
    ];
    if (client.clubs.length === 0) {
      return [[...summary, emptyCell, emptyCell]];
    }
    return client.clubs.map((club, index) =>
      index === 0
        ? [...summary, club.clubName, club.hasWebhook ? "yes" : emptyCell]
        : ["", "", "", "", club.clubName, club.hasWebhook ? "yes" : emptyCell],
    );
  });
}

export function renderClientTable(clients: ClientSummary[]): string {
  if (clients.length === 0) {
    return 'No clients yet — create one with "mday client add <name>".';
  }

  return renderTable(
    ["CLIENT ID", "NAME", "TOKENS", "LAST API USE", "FOLLOWED CLUB", "WEBHOOK"],
    toRows(clients),
  );
}
