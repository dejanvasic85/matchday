import {
  errorKindValue,
  hashApiToken,
  isErr,
  ok,
  serverError,
  unauthorized,
} from "@matchday/domain";
import {
  authenticateApiToken,
  recordApiTokenUse,
  type ApiTokenAuthDeps,
  type AuthenticatedApiToken,
} from "#services/apiTokenAuthService.ts";
import { apiTokenUsageValue } from "#constants.ts";

function makeTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok_abc123",
    clientId: "cli_abc123",
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ApiTokenAuthDeps> = {}): ApiTokenAuthDeps {
  return {
    findApiTokenByHash: vi.fn().mockResolvedValue(ok(makeTokenRow())),
    touchApiTokenLastUsed: vi.fn().mockResolvedValue(ok(undefined)),
    ...overrides,
  };
}

function makeAuthenticated(overrides: Partial<AuthenticatedApiToken> = {}): AuthenticatedApiToken {
  return { clientId: "cli_abc123", tokenId: "tok_abc123", lastUsedAt: null, ...overrides };
}

describe("authenticateApiToken", () => {
  it("returns the client id for a valid, unrevoked token", async () => {
    const deps = makeDeps();

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(ok({ clientId: "cli_abc123", tokenId: "tok_abc123", lastUsedAt: null }));
  });

  // The caller decides whether the stamp is due, so auth has to hand back what it read.
  it("returns the stored last-used stamp alongside the client id", async () => {
    const lastUsedAt = new Date("2026-09-06T01:00:00.000Z");
    const deps = makeDeps({
      findApiTokenByHash: vi.fn().mockResolvedValue(ok(makeTokenRow({ lastUsedAt }))),
    });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(ok({ clientId: "cli_abc123", tokenId: "tok_abc123", lastUsedAt }));
  });

  it("never writes a usage stamp itself — authentication stays read-only", async () => {
    const deps = makeDeps();

    await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(deps.touchApiTokenLastUsed).not.toHaveBeenCalled();
  });

  it("hashes the token before lookup, never passing it as plaintext", async () => {
    const deps = makeDeps();

    await authenticateApiToken(deps, "Bearer mday_sometoken");

    const expectedHash = await hashApiToken("mday_sometoken");
    expect(deps.findApiTokenByHash).toHaveBeenCalledWith(expectedHash);
  });

  it("rejects a missing Authorization header", async () => {
    const deps = makeDeps();

    const result = await authenticateApiToken(deps, undefined);

    expect(result).toEqual(unauthorized("Invalid or missing API token"));
    expect(deps.findApiTokenByHash).not.toHaveBeenCalled();
  });

  it("rejects a header without the Bearer scheme", async () => {
    const deps = makeDeps();

    const result = await authenticateApiToken(deps, "mday_sometoken");

    expect(result).toEqual(unauthorized("Invalid or missing API token"));
    expect(deps.findApiTokenByHash).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    const deps = makeDeps({ findApiTokenByHash: vi.fn().mockResolvedValue(ok(null)) });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(unauthorized("Invalid or missing API token"));
  });

  it("rejects a revoked token", async () => {
    const deps = makeDeps({
      findApiTokenByHash: vi.fn().mockResolvedValue(ok(makeTokenRow({ revokedAt: new Date() }))),
    });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(unauthorized("Invalid or missing API token"));
  });

  // An unreachable token store must not masquerade as a rejected credential: the caller's token
  // may be perfectly valid, so this has to stay a ServerError (a logged 500), never a 401.
  it("propagates a lookup failure as a ServerError rather than an Unauthorized", async () => {
    const lookupError = serverError("Failed to find api token by hash");
    const deps = makeDeps({ findApiTokenByHash: vi.fn().mockResolvedValue(lookupError) });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(lookupError);
    expect(isErr(result) && result.error.kind).toBe(errorKindValue.serverError);
  });

  it("errors when the token row's client id doesn't have the client prefix", async () => {
    const deps = makeDeps({
      findApiTokenByHash: vi
        .fn()
        .mockResolvedValue(ok(makeTokenRow({ clientId: "clb_wrong0000" }))),
    });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    // A corrupt stored row is our bug, not a bad credential — it must not surface as a 401.
    expect(isErr(result) && result.error.kind).toBe(errorKindValue.serverError);
  });

  it("errors when the token row's own id doesn't have the api token prefix", async () => {
    const deps = makeDeps({
      findApiTokenByHash: vi.fn().mockResolvedValue(ok(makeTokenRow({ id: "clb_wrong0000" }))),
    });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(isErr(result) && result.error.kind).toBe(errorKindValue.serverError);
  });
});

describe("recordApiTokenUse", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("stamps a token that has never been used", async () => {
    const deps = makeDeps();

    const result = await recordApiTokenUse(deps, makeAuthenticated(), now);

    expect(deps.touchApiTokenLastUsed).toHaveBeenCalledWith("tok_abc123", now);
    expect(result).toEqual(ok(undefined));
  });

  it("skips the write while the stored stamp is still inside the window", async () => {
    const deps = makeDeps();
    const lastUsedAt = new Date(now.getTime() - apiTokenUsageValue.recordWindowMs + 1000);

    const result = await recordApiTokenUse(deps, makeAuthenticated({ lastUsedAt }), now);

    expect(deps.touchApiTokenLastUsed).not.toHaveBeenCalled();
    expect(result).toEqual(ok(undefined));
  });

  it("stamps again once the stored stamp is a full window old", async () => {
    const deps = makeDeps();
    const lastUsedAt = new Date(now.getTime() - apiTokenUsageValue.recordWindowMs);

    await recordApiTokenUse(deps, makeAuthenticated({ lastUsedAt }), now);

    expect(deps.touchApiTokenLastUsed).toHaveBeenCalledWith("tok_abc123", now);
  });

  it("propagates a failed write so the caller can log it", async () => {
    const writeError = serverError("Failed to update api token last used at");
    const deps = makeDeps({ touchApiTokenLastUsed: vi.fn().mockResolvedValue(writeError) });

    const result = await recordApiTokenUse(deps, makeAuthenticated(), now);

    expect(result).toEqual(writeError);
  });
});
