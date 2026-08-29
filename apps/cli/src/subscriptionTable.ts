// Terminal rendering for `mday client list-subscriptions` and `mday client sync-subscriptions`
// — presentation only, so `--json` prints the service's shape untouched.

import type { SubscriptionWithLeague } from "@matchday/db";
import type { SubscriptionSyncPlan } from "#services/subscriptionSyncService.ts";

const columnGap = "  ";

function padRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => (index === cells.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
    .join(columnGap)
    .trimEnd();
}

function renderTable(header: string[], body: string[][]): string {
  const rows = [header, ...body];
  const widths = header.map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );
  return rows.map((row) => padRow(row, widths)).join("\n");
}

/** Season first: a subscription left behind by a finished season is what the operator is looking
 * for, and grouping it into the leftmost column makes it jump out. */
export function renderSubscriptionTable(subscriptions: SubscriptionWithLeague[]): string {
  if (subscriptions.length === 0) {
    return "No subscriptions.";
  }
  return renderTable(
    ["SEASON", "SUBSCRIPTION ID", "LEAGUE"],
    subscriptions.map((subscription) => [
      subscription.seasonName,
      subscription.id,
      subscription.leagueName,
    ]),
  );
}

/** The sync diff. Prints what *would* happen unless the plan was applied, so the operator sees
 * every league before a production write rather than after it. */
export function renderSyncPlan(plan: SubscriptionSyncPlan): string {
  const verb = plan.applied ? "Synced" : "Dry run — would sync";
  const clubs = plan.clubs.length === 0 ? "no followed clubs" : plan.clubs.join(", ");
  const lines = [
    `${verb} "${plan.client}" to season ${plan.season.name} (following: ${clubs})`,
    `  add: ${plan.additions.length}   remove: ${plan.removals.length}   unchanged: ${plan.unchangedCount}`,
  ];

  if (plan.additions.length > 0) {
    lines.push(
      "",
      renderTable(
        ["ADD LEAGUE", "VIA CLUB"],
        plan.additions.map((addition) => [addition.leagueName, addition.clubName]),
      ),
    );
  }

  if (plan.removals.length > 0) {
    lines.push(
      "",
      renderTable(
        ["REMOVE LEAGUE", "SEASON", "SUBSCRIPTION ID"],
        plan.removals.map((removal) => [
          removal.leagueName,
          removal.seasonName,
          removal.subscriptionId,
        ]),
      ),
    );
  }

  if (plan.additions.length === 0 && plan.removals.length === 0) {
    lines.push("", "Already up to date.");
  } else if (!plan.applied) {
    lines.push("", "Re-run with --apply to write these changes.");
  }

  return lines.join("\n");
}
