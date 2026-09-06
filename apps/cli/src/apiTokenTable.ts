// Terminal rendering for `mday client list-tokens` — presentation only, so `--json` prints the
// service's shape untouched.

import { apiTokenStatusValue, type ApiTokenUsage } from "#services/apiTokenService.ts";
import { emptyCell, renderTable } from "#terminalTable.ts";

/** Date only: last use is stamped at most once an hour, so printing a time would imply a
 * precision the stamp doesn't have. */
function dateCell(value: Date | null): string {
  return value === null ? emptyCell : value.toISOString().slice(0, "yyyy-mm-dd".length);
}

function lastUsedCell(token: ApiTokenUsage): string {
  if (token.lastUsedAt === null) {
    return "never";
  }
  return `${dateCell(token.lastUsedAt)} (${token.idleDays ?? 0}d ago)`;
}

function statusCell(token: ApiTokenUsage): string {
  return token.renewalDue && token.status !== apiTokenStatusValue.revoked
    ? `${token.status}, renew`
    : token.status;
}

export function renderApiTokenTable(tokens: ApiTokenUsage[]): string {
  if (tokens.length === 0) {
    return 'No tokens for this client — issue one with "mday client create-token <name>".';
  }

  return renderTable(
    ["TOKEN ID", "STATUS", "ISSUED", "AGE", "LAST USED"],
    tokens.map((token) => [
      token.id,
      statusCell(token),
      dateCell(token.createdAt),
      `${token.ageDays}d`,
      lastUsedCell(token),
    ]),
  );
}
