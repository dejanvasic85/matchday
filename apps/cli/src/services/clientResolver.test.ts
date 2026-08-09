import { err, ok } from "@matchday/domain";
import { resolveClient, type ClientResolverDeps } from "./clientResolver.ts";

function makeDeps(overrides: Partial<ClientResolverDeps> = {}): ClientResolverDeps {
  return {
    upsertClientByName: vi
      .fn()
      .mockResolvedValue(ok({ id: "cli_generated", name: "Williamstown SC" })),
    ...overrides,
  };
}

describe("resolveClient", () => {
  it("returns the upserted client's id", async () => {
    const deps = makeDeps({
      upsertClientByName: vi
        .fn()
        .mockResolvedValue(ok({ id: "cli_existing000", name: "Williamstown SC" })),
    });

    const result = await resolveClient(deps, "Williamstown SC");

    expect(result).toEqual(ok("cli_existing000"));
    expect(deps.upsertClientByName).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Williamstown SC" }),
    );
  });

  it("propagates an upsert failure", async () => {
    const upsertError = err({ message: "Failed to upsert client" });
    const deps = makeDeps({ upsertClientByName: vi.fn().mockResolvedValue(upsertError) });

    const result = await resolveClient(deps, "Williamstown SC");

    expect(result).toEqual(upsertError);
  });

  it("errors when the upserted client row id doesn't have the client prefix", async () => {
    const deps = makeDeps({
      upsertClientByName: vi
        .fn()
        .mockResolvedValue(ok({ id: "clb_wrong0000", name: "Williamstown SC" })),
    });

    const result = await resolveClient(deps, "Williamstown SC");

    expect(result.ok).toBe(false);
  });
});
