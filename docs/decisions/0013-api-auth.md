# 0013. API auth

- Status: proposed
- Date: 2026-08-09

## Context

`apps/api` is new and not yet public (Phase 4, issue #77, supersedes #52). Consumers are
known, service-to-service clients (each tenant's own backend), not end users — so this doesn't
need user-facing auth, just a way to identify and authorize a tenant per request.

## Options

- **Per-tenant API tokens** (bearer header) — simple, matches service-to-service shape.
- OAuth2 / JWT — built for user-facing/delegated auth; no such flow exists here.
- mTLS — heavier ops (cert issuance/rotation) than a new, low-volume API warrants.

## Recommendation

Static **per-tenant API tokens**, sent as `Authorization: Bearer <token>`, validated in Hono
middleware. Store only a hash of each token (never plaintext).

Support **multiple active tokens per tenant** at once, like an AWS access key pair: a tenant can
issue a new token, roll it into their client, then revoke the old one — no shared downtime
window. No scopes, roles, or expiry for v1; one token grants full read access to that tenant's
subscribed data. This is a new API with a handful of consumers — keep it this simple until there's
a reason not to.

## Consequences

- New `api_token` table in `packages/db`: `tenant_id`, `token_hash`, `created_at`, `revoked_at`.
- Hono middleware resolves the tenant from the bearer token; rejects missing/unknown/revoked.
- Token issuance/revocation path (CLI or manual) is an implementation detail of #77, not this ADR.
- Rate-limiting is out of scope here — tracked separately if/when needed.
