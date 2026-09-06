import { notFound, ok, serverError } from "@matchday/domain";
import {
  apiTokenStatusValue,
  createApiToken,
  listApiTokenUsage,
  revokeApiTokenById,
  type ApiTokenServiceDeps,
} from "#services/apiTokenService.ts";
import { apiTokenLifecycleValue } from "#services/constants.ts";

const now = new Date("2026-09-06T00:00:00.000Z");

function daysBefore(days: number): Date {
  return new Date(now.getTime() - days * apiTokenLifecycleValue.msPerDay);
}

function makeTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok_existing000",
    clientId: "cli_existing000",
    revokedAt: null,
    lastUsedAt: daysBefore(1),
    createdAt: daysBefore(30),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<ApiTokenServiceDeps> = {}): ApiTokenServiceDeps {
  return {
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    insertApiToken: vi
      .fn()
      .mockResolvedValue(ok({ id: "tok_generated000", clientId: "cli_existing000" })),
    revokeApiToken: vi.fn().mockResolvedValue(ok({ id: "tok_existing000", revokedAt: new Date() })),
    listApiTokensByClientId: vi.fn().mockResolvedValue(ok([makeTokenRow()])),
    ...overrides,
  };
}

describe("createApiToken", () => {
  it("returns the newly generated token id and plaintext token", async () => {
    const deps = makeDeps();

    const result = await createApiToken(deps, "Williamstown SC");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id.startsWith("tok_")).toBe(true);
      expect(result.value.token.startsWith("mday_")).toBe(true);
      expect(deps.insertApiToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: result.value.id, clientId: "cli_existing000" }),
      );
    }
  });

  it("persists only the token's hash, not the plaintext", async () => {
    const deps = makeDeps();

    const result = await createApiToken(deps, "Williamstown SC");

    expect(result.ok).toBe(true);
    const insertedValues = vi.mocked(deps.insertApiToken).mock.calls[0]?.[0];
    expect(insertedValues).toMatchObject({ clientId: "cli_existing000" });
    expect(insertedValues?.tokenHash).not.toEqual(result.ok ? result.value.token : undefined);
    expect(insertedValues?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("propagates a client resolution failure without inserting a token", async () => {
    const clientError = serverError("Failed to find client by name");
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(clientError) });

    const result = await createApiToken(deps, "Williamstown SC");

    expect(result).toEqual(clientError);
    expect(deps.insertApiToken).not.toHaveBeenCalled();
  });

  it("errors without inserting a token when the client name is unknown", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await createApiToken(deps, "Typo FC");

    expect(result.ok).toBe(false);
    expect(deps.insertApiToken).not.toHaveBeenCalled();
  });

  it("propagates an insert failure", async () => {
    const insertError = serverError("Failed to insert api token");
    const deps = makeDeps({ insertApiToken: vi.fn().mockResolvedValue(insertError) });

    const result = await createApiToken(deps, "Williamstown SC");

    expect(result).toEqual(insertError);
  });
});

describe("revokeApiTokenById", () => {
  it("succeeds when the token exists", async () => {
    const deps = makeDeps();

    const result = await revokeApiTokenById(deps, "tok_existing000");

    expect(result).toEqual(ok(undefined));
    expect(deps.revokeApiToken).toHaveBeenCalledWith("tok_existing000");
  });

  it("errors when the token id doesn't exist", async () => {
    const deps = makeDeps({ revokeApiToken: vi.fn().mockResolvedValue(ok(null)) });

    const result = await revokeApiTokenById(deps, "tok_missing0000");

    expect(result).toEqual(notFound("Api token not found: tok_missing0000"));
  });

  it("propagates a revoke failure", async () => {
    const revokeError = serverError("Failed to revoke api token");
    const deps = makeDeps({ revokeApiToken: vi.fn().mockResolvedValue(revokeError) });

    const result = await revokeApiTokenById(deps, "tok_existing000");

    expect(result).toEqual(revokeError);
  });
});

describe("listApiTokenUsage", () => {
  it("reports a recently used token as active, with its age and idle days", async () => {
    const deps = makeDeps();

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result).toEqual(
      ok([
        {
          id: "tok_existing000",
          status: apiTokenStatusValue.active,
          createdAt: daysBefore(30),
          lastUsedAt: daysBefore(1),
          revokedAt: null,
          ageDays: 30,
          idleDays: 1,
          renewalDue: false,
        },
      ]),
    );
  });

  // The one an operator is looking for: issued, never rolled out, safe to revoke.
  it("reports a token that has never authenticated as unused", async () => {
    const deps = makeDeps({
      listApiTokensByClientId: vi.fn().mockResolvedValue(ok([makeTokenRow({ lastUsedAt: null })])),
    });

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        status: apiTokenStatusValue.unused,
        idleDays: null,
      });
    }
  });

  it("reports a token silent for the idle threshold as idle", async () => {
    const deps = makeDeps({
      listApiTokensByClientId: vi
        .fn()
        .mockResolvedValue(
          ok([makeTokenRow({ lastUsedAt: daysBefore(apiTokenLifecycleValue.idleAfterDays) })]),
        ),
    });

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.status).toBe(apiTokenStatusValue.idle);
    }
  });

  it("reports a revoked token as revoked, whatever its usage says", async () => {
    const deps = makeDeps({
      listApiTokensByClientId: vi
        .fn()
        .mockResolvedValue(ok([makeTokenRow({ revokedAt: daysBefore(2) })])),
    });

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        status: apiTokenStatusValue.revoked,
        renewalDue: false,
      });
    }
  });

  it("flags a token past the renewal threshold that is still in use", async () => {
    const deps = makeDeps({
      listApiTokensByClientId: vi
        .fn()
        .mockResolvedValue(
          ok([makeTokenRow({ createdAt: daysBefore(apiTokenLifecycleValue.renewAfterDays) })]),
        ),
    });

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toMatchObject({
        status: apiTokenStatusValue.active,
        renewalDue: true,
      });
    }
  });

  it("fails with notFound for an unknown client rather than an empty list", async () => {
    const deps = makeDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await listApiTokenUsage(deps, "Nobody FC", now);

    expect(result).toEqual(
      notFound('Client not found: Nobody FC. Create it first with "mday client add".'),
    );
    expect(deps.listApiTokensByClientId).not.toHaveBeenCalled();
  });

  it("propagates a failed token read", async () => {
    const readError = serverError("Failed to list api tokens by client id");
    const deps = makeDeps({ listApiTokensByClientId: vi.fn().mockResolvedValue(readError) });

    const result = await listApiTokenUsage(deps, "Williamstown SC", now);

    expect(result).toEqual(readError);
  });
});
