import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "./resolveEntityByExternalRef.ts";

const epoch = new Date("2026-01-01T00:00:00.000Z");

function makeExternalRefRow(overrides: Partial<{ internalId: string }> = {}) {
  return {
    id: "ext_row0000001",
    entityType: "team",
    internalId: "tea_existing001",
    source: "dribl" as const,
    sourceId: "team-source-1",
    sourceUrl: null,
    createdAt: epoch,
    updatedAt: epoch,
    ...overrides,
  };
}

describe("resolveEntityByExternalRef", () => {
  it("upserts the entity with the existing internal id when an external_ref is found", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });
    const upsertEntity = vi.fn().mockResolvedValue(ok(undefined));

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-1",
      upsertEntity,
    });

    expect(result).toEqual({ ok: true, value: "tea_existing001" });
    expect(upsertEntity).toHaveBeenCalledWith("tea_existing001");
    expect(deps.upsertExternalRef).not.toHaveBeenCalled();
  });

  it("generates a new id, upserts the entity, and writes external_ref on first sight", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });
    const upsertEntity = vi.fn().mockResolvedValue(ok(undefined));

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-2",
      upsertEntity,
    });

    expect(result.ok).toBe(true);
    expect(upsertEntity).toHaveBeenCalledTimes(1);
    expect(deps.upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "team", sourceId: "team-source-2" }),
    );
  });

  it("returns err when the existing external_ref's internalId has an unexpected prefix", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi
        .fn()
        .mockResolvedValue(ok(makeExternalRefRow({ internalId: "clb_wrong_prefix" }))),
    });
    const upsertEntity = vi.fn();

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-1",
      upsertEntity,
    });

    expect(result.ok).toBe(false);
    expect(upsertEntity).not.toHaveBeenCalled();
  });

  it("propagates an upsertEntity failure without writing external_ref", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
    });
    const upsertEntity = vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } });

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-3",
      upsertEntity,
    });

    expect(result.ok).toBe(false);
    expect(deps.upsertExternalRef).not.toHaveBeenCalled();
  });
});
