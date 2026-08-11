import {
  errorKindValue,
  hashApiToken,
  isErr,
  ok,
  serverError,
  unauthorized,
} from "@matchday/domain";
import { authenticateApiToken, type ApiTokenAuthDeps } from "#services/apiTokenAuthService.ts";

function makeDeps(overrides: Partial<ApiTokenAuthDeps> = {}): ApiTokenAuthDeps {
  return {
    findApiTokenByHash: vi.fn().mockResolvedValue(ok({ clientId: "cli_abc123", revokedAt: null })),
    ...overrides,
  };
}

describe("authenticateApiToken", () => {
  it("returns the client id for a valid, unrevoked token", async () => {
    const deps = makeDeps();

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    expect(result).toEqual(ok("cli_abc123"));
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
      findApiTokenByHash: vi
        .fn()
        .mockResolvedValue(ok({ clientId: "cli_abc123", revokedAt: new Date() })),
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
        .mockResolvedValue(ok({ clientId: "clb_wrong0000", revokedAt: null })),
    });

    const result = await authenticateApiToken(deps, "Bearer mday_sometoken");

    // A corrupt stored row is our bug, not a bad credential — it must not surface as a 401.
    expect(isErr(result) && result.error.kind).toBe(errorKindValue.serverError);
  });
});
