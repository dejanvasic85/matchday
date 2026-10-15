// Client-club follows: a client's interest in a club, and the owner of the post-crawl webhook.

import {
  err,
  errorKindValue,
  generateId,
  notFound,
  ok,
  type Result,
  type ResultError,
} from "@matchday/domain";
import type {
  clearClientClubWebhook as clearClientClubWebhookDb,
  deleteClientClub,
  setClientClubWebhook as setClientClubWebhookDb,
  upsertClientClub,
} from "@matchday/db";
import { setClubWebhookById, unfollowClubById } from "@matchday/services";
import { resolveClub, type ClubResolverDeps, type ResolvedClub } from "#services/clubResolver.ts";
import { resolveClient, type ClientResolverDeps } from "#services/clientResolver.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClientClubServiceDeps = ClientResolverDeps &
  ClubResolverDeps & {
    upsertClientClub: WithoutDb<typeof upsertClientClub>;
    deleteClientClub: WithoutDb<typeof deleteClientClub>;
    setClientClubWebhook: WithoutDb<typeof setClientClubWebhookDb>;
    clearClientClubWebhook: WithoutDb<typeof clearClientClubWebhookDb>;
  };

export type FollowedClub = {
  client: string;
  club: ResolvedClub;
};

/** Record that a client follows a club. Idempotent, and never touches an already-configured
 * webhook. */
export async function followClub(
  deps: Pick<ClientClubServiceDeps, "findClientByName" | "findClubsByName" | "upsertClientClub">,
  clientName: string,
  clubName: string,
): Promise<Result<FollowedClub>> {
  // Club first: an ambiguous or typo'd `--club` should fail before we touch anything.
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const id = generateId("clientClub");
  const upserted = await deps.upsertClientClub({
    id,
    clientId: clientResult.value,
    clubId: clubResult.value.id,
  });
  if (!upserted.ok) {
    return upserted;
  }

  return ok({ client: clientName, club: clubResult.value });
}

/** Stop a client following a club. Any webhook on the follow is removed with it. */
export async function unfollowClub(
  deps: Pick<ClientClubServiceDeps, "findClientByName" | "findClubsByName" | "deleteClientClub">,
  clientName: string,
  clubName: string,
): Promise<Result<FollowedClub>> {
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const deleted = await unfollowClubById(deps, {
    clientId: clientResult.value,
    clubId: clubResult.value.id,
  });
  if (!deleted.ok) {
    return withNames(deleted.error, `"${clientName}" doesn't follow "${clubResult.value.name}"`);
  }

  return ok({ client: clientName, club: clubResult.value });
}

/** Swap the shared service's id-based "not following" message for one naming what the operator
 * typed. Every other failure passes through unchanged. */
function withNames(error: ResultError, message: string): Result<never> {
  return error.kind === errorKindValue.notFound ? notFound(message) : err(error);
}

export type ConfiguredWebhook = {
  club: ResolvedClub;
  webhookUrl: string;
  /** Shown once here, like `createApiToken`'s plaintext token — only its value in this response
   * is ever available; the persisted row is opaque after this call returns. */
  webhookSecret: string;
};

/**
 * Configure (or replace) a followed club's webhook: validates the URL, mints a fresh signing
 * secret, and persists both. Re-running rotates the secret — there's no "keep the old secret"
 * path, matching how `create-token` always mints a new token rather than exposing an existing one.
 *
 * The webhook fires for every crawled league the club plays in, and the delivery names the league
 * in its signed body — so one webhook per club covers a whole season and survives the next rollover.
 */
export async function setClientClubWebhook(
  deps: Pick<
    ClientClubServiceDeps,
    "findClientByName" | "findClubsByName" | "setClientClubWebhook"
  >,
  clientName: string,
  clubName: string,
  webhookUrl: string,
): Promise<Result<ConfiguredWebhook>> {
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const configured = await setClubWebhookById(deps, {
    clientId: clientResult.value,
    clubId: clubResult.value.id,
    webhookUrl,
  });
  if (!configured.ok) {
    return withNames(
      configured.error,
      `"${clientName}" doesn't follow "${clubResult.value.name}" — run \`mday client follow-club\` first`,
    );
  }

  return ok({
    club: clubResult.value,
    webhookUrl: configured.value.webhookUrl,
    webhookSecret: configured.value.webhookSecret,
  });
}

/** Clear a followed club's webhook, reporting a client that doesn't follow the club as
 * `notFound` rather than exiting 0 on a no-op. */
export async function clearClientClubWebhook(
  deps: Pick<
    ClientClubServiceDeps,
    "findClientByName" | "findClubsByName" | "clearClientClubWebhook"
  >,
  clientName: string,
  clubName: string,
): Promise<Result<ResolvedClub>> {
  const clubResult = await resolveClub(deps, clubName);
  if (!clubResult.ok) {
    return clubResult;
  }

  const clientResult = await resolveClient(deps, clientName);
  if (!clientResult.ok) {
    return clientResult;
  }

  const updated = await deps.clearClientClubWebhook(clientResult.value, clubResult.value.id);
  if (!updated.ok) {
    return updated;
  }
  if (updated.value === null) {
    return notFound(`"${clientName}" doesn't follow "${clubResult.value.name}"`);
  }

  return ok(clubResult.value);
}
