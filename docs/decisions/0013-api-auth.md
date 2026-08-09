# 0013. API auth

- Status: proposed
- Date: 2026-08-09

## Context

`apps/api` is new and not yet public (Phase 4, issue #77, supersedes #52). Consumers are
known, service-to-service clients (each client's own backend), not end users — so this doesn't
need user-facing auth, just a way to identify and authorize a client per request. `subscription`
(0012) already has a client concept, but only as a free-text `clientName` — this ADR promotes it
to a real `client` entity so tokens (and subscriptions) can reference one consistently.

## Options

- **Per-client API tokens** (bearer header) — simple, matches service-to-service shape.
- OAuth2 / JWT — built for user-facing/delegated auth; no such flow exists here.
- mTLS — heavier ops (cert issuance/rotation) than a new, low-volume API warrants.

## Recommendation

Static **per-client API tokens**, sent as `Authorization: Bearer <token>`, validated in Hono
middleware. Store only a hash of each token (never plaintext).

Support **multiple active tokens per client** at once, like an AWS access key pair: a client can
issue a new token, roll it into their integration, then revoke the old one — no shared downtime
window. No scopes, roles, or expiry for v1; one token grants full read access to that client's
subscribed data. This is a new API with a handful of consumers — keep it this simple until there's
a reason not to.

## Consequences

- New `client` table in `packages/db` (id, name). `subscription.clientName` becomes
  `subscription.clientId` → `client.id`.
- New `api_token` table: `clientId`, `tokenHash`, `createdAt`, `revokedAt`.
- Hono middleware resolves the client from the bearer token; rejects missing/unknown/revoked.
- Token issuance/revocation path (CLI or manual) is an implementation detail of #77, not this ADR.
- Rate-limiting is out of scope here — tracked separately if/when needed.
