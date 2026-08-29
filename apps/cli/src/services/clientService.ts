// Client roster assembly: stitches three flat data-access reads into the per-client view
// `mday client list` renders — three queries total, not 2N+1.

import { ok, type Result } from "@matchday/domain";
import type {
  listApiTokens,
  listClientClubs,
  listClients,
  listSubscriptionsWithLeague,
} from "@matchday/db";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClientServiceDeps = {
  listClients: WithoutDb<typeof listClients>;
  listApiTokens: WithoutDb<typeof listApiTokens>;
  listClientClubs: WithoutDb<typeof listClientClubs>;
  listSubscriptionsWithLeague: WithoutDb<typeof listSubscriptionsWithLeague>;
};

export type ClientSubscriptionSummary = {
  id: string;
  leagueId: string;
  leagueName: string;
  seasonName: string;
};

/** A followed club, with whether it has a webhook — the webhook lives here now, not on the
 * subscription, so it survives a season rollover. */
export type ClientClubSummary = {
  id: string;
  clubId: string;
  clubName: string;
  hasWebhook: boolean;
};

export type ClientSummary = {
  id: string;
  name: string;
  /** Tokens that can still authenticate — revoked ones are excluded from the count. */
  activeTokenCount: number;
  clubs: ClientClubSummary[];
  subscriptions: ClientSubscriptionSummary[];
};

function groupByClientId<T extends { clientId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.clientId);
    if (existing === undefined) {
      grouped.set(row.clientId, [row]);
      continue;
    }
    existing.push(row);
  }
  return grouped;
}

export async function listClientSummaries(
  deps: ClientServiceDeps,
): Promise<Result<ClientSummary[]>> {
  const clientsResult = await deps.listClients();
  if (!clientsResult.ok) {
    return clientsResult;
  }

  const tokensResult = await deps.listApiTokens();
  if (!tokensResult.ok) {
    return tokensResult;
  }

  const subscriptionsResult = await deps.listSubscriptionsWithLeague();
  if (!subscriptionsResult.ok) {
    return subscriptionsResult;
  }

  const clubsResult = await deps.listClientClubs();
  if (!clubsResult.ok) {
    return clubsResult;
  }

  const tokensByClient = groupByClientId(tokensResult.value);
  const subscriptionsByClient = groupByClientId(subscriptionsResult.value);
  const clubsByClient = groupByClientId(clubsResult.value);

  return ok(
    clientsResult.value.map((row) => ({
      id: row.id,
      name: row.name,
      activeTokenCount: (tokensByClient.get(row.id) ?? []).filter(
        (token) => token.revokedAt === null,
      ).length,
      clubs: (clubsByClient.get(row.id) ?? []).map((clientClub) => ({
        id: clientClub.id,
        clubId: clientClub.clubId,
        clubName: clientClub.clubName,
        hasWebhook: clientClub.webhookUrl !== null,
      })),
      subscriptions: (subscriptionsByClient.get(row.id) ?? []).map((subscription) => ({
        id: subscription.id,
        leagueId: subscription.leagueId,
        leagueName: subscription.leagueName,
        seasonName: subscription.seasonName,
      })),
    })),
  );
}
