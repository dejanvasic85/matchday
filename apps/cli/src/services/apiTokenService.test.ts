import { notFound, ok, serverError } from "@matchday/domain";
import {
  createApiToken,
  revokeApiTokenById,
  type ApiTokenServiceDeps,
} from "@/src/services/apiTokenService.ts";

function makeDeps(overrides: Partial<ApiTokenServiceDeps> = {}): ApiTokenServiceDeps {
  return {
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    insertApiToken: vi
      .fn()
      .mockResolvedValue(ok({ id: "tok_generated000", clientId: "cli_existing000" })),
    revokeApiToken: vi.fn().mockResolvedValue(ok({ id: "tok_existing000", revokedAt: new Date() })),
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
