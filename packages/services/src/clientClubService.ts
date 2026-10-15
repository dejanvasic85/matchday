// Client-club follows by id: the writes the API and the CLI share. Callers bring ids, so the API
// passes them straight from the URL and the CLI resolves names first.

import {
  generateId,
  generateWebhookSecret,
  notFound,
  ok,
  type ClientId,
  type ClubId,
  type Result,
} from "@matchday/domain";
import type {
  deleteClientClub,
  getClubById,
  setClientClubWebhook,
  upsertClientClubWithWebhook,
} from "@matchday/db";
import { validateWebhookUrl } from "#webhookUrl.ts";

type WithoutDb<F> = F extends (db: never, ...rest: infer Rest) => infer Return
  ? (...rest: Rest) => Return
  : never;

export type ClientClubServiceDeps = {
  getClubById: WithoutDb<typeof getClubById>;
  upsertClientClubWithWebhook: WithoutDb<typeof upsertClientClubWithWebhook>;
  setClientClubWebhook: WithoutDb<typeof setClientClubWebhook>;
  deleteClientClub: WithoutDb<typeof deleteClientClub>;
};

export type ClientClubKey = {
  clientId: ClientId;
  clubId: ClubId;
};

export type ClubWebhookInput = ClientClubKey & { webhookUrl: string };

export type ClubWebhook = {
  clubId: ClubId;
  webhookUrl: string;
  /** Returned once, here. The stored copy is never read back out. */
  webhookSecret: string;
};

const notFollowedMessage = "The client doesn't follow this club";

/** Follow a club and set its webhook with a fresh secret, in one write. Calling it again rotates
 * the secret, so the latest response always holds the live one. */
export async function followClubById(
  deps: Pick<ClientClubServiceDeps, "getClubById" | "upsertClientClubWithWebhook">,
  input: ClubWebhookInput,
): Promise<Result<ClubWebhook>> {
  const url = validateWebhookUrl(input.webhookUrl);
  if (!url.ok) {
    return url;
  }

  // Checked first so an unknown club is a 404, not a foreign-key failure on the write.
  const club = await deps.getClubById(input.clubId);
  if (!club.ok) {
    return club;
  }
  if (club.value === null) {
    return notFound("Club not found");
  }

  const webhookSecret = generateWebhookSecret();
  const upserted = await deps.upsertClientClubWithWebhook({
    id: generateId("clientClub"),
    clientId: input.clientId,
    clubId: input.clubId,
    webhookUrl: url.value,
    webhookSecret,
  });
  if (!upserted.ok) {
    return upserted;
  }

  return ok({ clubId: input.clubId, webhookUrl: url.value, webhookSecret });
}

/** Set (or rotate) the webhook on an existing follow. A client that doesn't follow the club is
 * `notFound`: this never creates a follow. */
export async function setClubWebhookById(
  deps: Pick<ClientClubServiceDeps, "setClientClubWebhook">,
  input: ClubWebhookInput,
): Promise<Result<ClubWebhook>> {
  const url = validateWebhookUrl(input.webhookUrl);
  if (!url.ok) {
    return url;
  }

  const webhookSecret = generateWebhookSecret();
  const updated = await deps.setClientClubWebhook(
    input.clientId,
    input.clubId,
    url.value,
    webhookSecret,
  );
  if (!updated.ok) {
    return updated;
  }
  if (updated.value === null) {
    return notFound(notFollowedMessage);
  }

  return ok({ clubId: input.clubId, webhookUrl: url.value, webhookSecret });
}

/** Stop following a club. Its webhook goes with it. */
export async function unfollowClubById(
  deps: Pick<ClientClubServiceDeps, "deleteClientClub">,
  input: ClientClubKey,
): Promise<Result<ClientClubKey>> {
  const deleted = await deps.deleteClientClub(input.clientId, input.clubId);
  if (!deleted.ok) {
    return deleted;
  }
  if (deleted.value === null) {
    return notFound(notFollowedMessage);
  }
  return ok(input);
}
