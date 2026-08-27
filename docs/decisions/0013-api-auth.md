# 0013. API auth

- Status: proposed
- Date: 2026-08-09

## Context

`apps/api` is new and not yet public (Phase 4, issue #77, which supersedes #52). Our consumers are
known service-to-service clients — each client's own backend — not end users. So we need no
user-facing authentication, only a way to identify and authorise a client on each request.

`subscription` in 0012 already has a client concept, but only as free-text `clientName`. This ADR
promotes it to a real `client` entity, so both tokens and subscriptions can reference one
consistently.

## Options

- **Per-client API tokens**, sent in a bearer header — simple, and matches a service-to-service
  shape.
- **OAuth2 or JWT** — built for user-facing and delegated authentication. We have no such flow.
- **Mutual TLS** — issuing and rotating certificates costs more operational work than a new,
  low-volume API justifies.

## Recommendation

Static **per-client API tokens**, sent as `Authorization: Bearer <token>` and validated in Hono
middleware. Store only a hash of each token, never the plaintext.

Let a client hold **several active tokens at once**, like an AWS access key pair. The client can
issue a new token, roll it into their integration, then revoke the old one, with no window where
both are down. For v1 we add no scopes, roles or expiry: one token grants full read access to
that client's subscribed data. This is a new API with a handful of consumers, so keep it this
simple until something forces otherwise.

## Consequences

- A new `client` table in `packages/db`, holding an id and a name. `subscription.clientName`
  becomes `subscription.clientId`, pointing at `client.id`.
- A new `api_token` table: `clientId`, `tokenHash`, `createdAt` and `revokedAt`.
- Hono middleware resolves the client from the bearer token, and rejects a token that is missing,
  unknown or revoked.
- How we issue and revoke tokens, by CLI or by hand, is an implementation detail of #77 rather
  than this ADR.
- Rate limiting is out of scope here. We track it separately, if and when we need it.
