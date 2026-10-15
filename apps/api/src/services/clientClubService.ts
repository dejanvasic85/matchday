// Wires the shared follow service to a live `db`; the logic lives in @matchday/services.

import {
  deleteClientClub,
  getClubById,
  setClientClubWebhook,
  upsertClientClubWithWebhook,
  type Db,
} from "@matchday/db";
import type { ClientClubServiceDeps } from "@matchday/services";

export function createClientClubServiceDeps(db: Db): ClientClubServiceDeps {
  return {
    getClubById: (id) => getClubById(db, id),
    upsertClientClubWithWebhook: (input) => upsertClientClubWithWebhook(db, input),
    setClientClubWebhook: (clientId, clubId, webhookUrl, webhookSecret) =>
      setClientClubWebhook(db, clientId, clubId, webhookUrl, webhookSecret),
    deleteClientClub: (clientId, clubId) => deleteClientClub(db, clientId, clubId),
  };
}
