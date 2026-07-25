import { ok } from "@matchday/domain";
import { makeFakeEntityResolutionDeps } from "@/test/fixtures/entityResolutionDeps.ts";
import { resolveEntityByExternalRef } from "./externalRefEntityResolver.ts";

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

  it("generates a new id, writes external_ref, then upserts the entity on first sight", async () => {
    const upsertExternalRef = vi.fn().mockResolvedValue(ok(makeExternalRefRow()));
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef,
    });
    const upsertEntity = vi.fn().mockResolvedValue(ok(undefined));

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-2",
      upsertEntity,
    });

    assert(result.ok);
    expect(upsertEntity).toHaveBeenCalledTimes(1);
    expect(upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "team", sourceId: "team-source-2" }),
    );
    // The ref must be written before the entity so a failure between the two writes self-heals
    // on the next crawl rather than orphaning the entity.
    const refOrder = upsertExternalRef.mock.invocationCallOrder[0];
    const entityOrder = upsertEntity.mock.invocationCallOrder[0];
    expect(refOrder).toBeLessThan(entityOrder);
  });

  it("threads a custom source through both the lookup and the new external_ref", async () => {
    const findExternalRef = vi.fn().mockResolvedValue(ok(null));
    const upsertExternalRef = vi.fn().mockResolvedValue(ok(makeExternalRefRow()));
    const deps = makeFakeEntityResolutionDeps({ findExternalRef, upsertExternalRef });
    const upsertEntity = vi.fn().mockResolvedValue(ok(undefined));

    await resolveEntityByExternalRef({
      deps,
      entityType: "club",
      source: "dribl_club_code",
      sourceId: "club-code-1",
      upsertEntity,
    });

    expect(findExternalRef).toHaveBeenCalledWith("dribl_club_code", "club-code-1");
    expect(upsertExternalRef).toHaveBeenCalledWith(
      expect.objectContaining({ source: "dribl_club_code", sourceId: "club-code-1" }),
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

    assert(!result.ok);
    expect(upsertEntity).not.toHaveBeenCalled();
  });

  it("propagates an upsertEntity failure after the external_ref is written (self-heals next crawl)", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef: vi.fn().mockResolvedValue(ok(makeExternalRefRow())),
    });
    const upsertEntity = vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } });

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-3",
      upsertEntity,
    });

    assert(!result.ok);
    // The ref is written first, so a later entity failure leaves a ref (not an orphaned entity)
    // that the next crawl resolves back to the same id and completes.
    expect(deps.upsertExternalRef).toHaveBeenCalledTimes(1);
  });

  it("propagates an upsertExternalRef failure without upserting the entity", async () => {
    const deps = makeFakeEntityResolutionDeps({
      findExternalRef: vi.fn().mockResolvedValue(ok(null)),
      upsertExternalRef: vi.fn().mockResolvedValue({ ok: false, error: { message: "db down" } }),
    });
    const upsertEntity = vi.fn();

    const result = await resolveEntityByExternalRef({
      deps,
      entityType: "team",
      sourceId: "team-source-4",
      upsertEntity,
    });

    assert(!result.ok);
    expect(upsertEntity).not.toHaveBeenCalled();
  });
});
