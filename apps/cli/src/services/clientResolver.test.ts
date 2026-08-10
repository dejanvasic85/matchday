import { notFound, ok, serverError } from "@matchday/domain";
import {
  createClient,
  resolveClient,
  type ClientCreatorDeps,
  type ClientResolverDeps,
} from "#services/clientResolver.ts";

function makeResolverDeps(overrides: Partial<ClientResolverDeps> = {}): ClientResolverDeps {
  return {
    findClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    ...overrides,
  };
}

function makeCreatorDeps(overrides: Partial<ClientCreatorDeps> = {}): ClientCreatorDeps {
  return {
    upsertClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_generated0", name: "Williamstown SC" })),
    ...overrides,
  };
}

describe("resolveClient", () => {
  it("returns the found client's id", async () => {
    const deps = makeResolverDeps();

    const result = await resolveClient(deps, "Williamstown SC");

    expect(result).toEqual(ok("cli_existing000"));
    expect(deps.findClientByName).toHaveBeenCalledWith("Williamstown SC");
  });

  it("returns not found rather than creating a client when the name is unknown", async () => {
    const deps = makeResolverDeps({ findClientByName: vi.fn().mockResolvedValue(ok(null)) });

    const result = await resolveClient(deps, "Typo FC");

    expect(result.ok).toBe(false);
    expect(result).toEqual(
      notFound('Client not found: Typo FC. Create it first with "mday client add".'),
    );
  });

  it("propagates a lookup failure", async () => {
    const lookupError = serverError("Failed to find client by name");
    const deps = makeResolverDeps({ findClientByName: vi.fn().mockResolvedValue(lookupError) });

    const result = await resolveClient(deps, "Williamstown SC");

    expect(result).toEqual(lookupError);
  });

  it("errors when the found client row id doesn't have the client prefix", async () => {
    const deps = makeResolverDeps({
      findClientByName: vi.fn().mockResolvedValue(ok({ id: "clb_wrong0000", name: "Wrong" })),
    });

    const result = await resolveClient(deps, "Wrong");

    expect(result.ok).toBe(false);
  });
});

describe("createClient", () => {
  it("returns the upserted client's id", async () => {
    const deps = makeCreatorDeps();

    const result = await createClient(deps, "Williamstown SC");

    expect(result).toEqual(ok("cli_generated0"));
    expect(deps.upsertClientByName).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Williamstown SC" }),
    );
  });

  it("returns the existing client's id when the name is already taken", async () => {
    const deps = makeCreatorDeps({
      upsertClientByName: vi
        .fn()
        .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    });

    const result = await createClient(deps, "Williamstown SC");

    expect(result).toEqual(ok("cli_existing000"));
  });

  it("propagates an upsert failure", async () => {
    const upsertError = serverError("Failed to upsert client");
    const deps = makeCreatorDeps({ upsertClientByName: vi.fn().mockResolvedValue(upsertError) });

    const result = await createClient(deps, "Williamstown SC");

    expect(result).toEqual(upsertError);
  });

  it("errors when the upserted client row id doesn't have the client prefix", async () => {
    const deps = makeCreatorDeps({
      upsertClientByName: vi
        .fn()
        .mockResolvedValue(ok({ id: "clb_wrong0000", name: "Williamstown SC" })),
    });

    const result = await createClient(deps, "Williamstown SC");

    expect(result.ok).toBe(false);
  });
});
