import { makeQueuedFakePage } from "@/test/fixtures/fakePage.ts";
import { listCompetitions, listLeagues, listSeasons, resolveTenantId } from "./listDriblCatalog.ts";

describe("resolveTenantId", () => {
  it("resolves the tenant id from the tenants response", async () => {
    const page = makeQueuedFakePage([{ data: { id: "tenant-id" } }]);

    const result = await resolveTenantId(page, "fv.dribl.com", "fv");

    expect(result).toEqual({ ok: true, value: "tenant-id" });
  });

  it("returns err on an invalid tenants response", async () => {
    const page = makeQueuedFakePage([{ data: {} }]);

    const result = await resolveTenantId(page, "fv.dribl.com", "fv");

    expect(result.ok).toBe(false);
  });
});

describe("listSeasons", () => {
  it("normalizes top-level id/name items to attributes.name", async () => {
    const page = makeQueuedFakePage([{ data: [{ id: "season-id", name: "2026" }] }]);

    const result = await listSeasons(page, "tenant-id");

    expect(result).toEqual({
      ok: true,
      value: [{ id: "season-id", attributes: { name: "2026" } }],
    });
  });
});

describe("listCompetitions", () => {
  it("returns every competition, unfiltered", async () => {
    const page = makeQueuedFakePage([
      {
        data: [
          { id: "comp-1", name: "Senol NPL Victoria Men" },
          { id: "comp-2", name: "Senol NPL Victoria Women" },
        ],
      },
    ]);

    const result = await listCompetitions(page, "tenant-id");

    expect(result).toEqual({
      ok: true,
      value: [
        { id: "comp-1", attributes: { name: "Senol NPL Victoria Men" } },
        { id: "comp-2", attributes: { name: "Senol NPL Victoria Women" } },
      ],
    });
  });
});

describe("listLeagues", () => {
  it("returns every league for the given competition, unfiltered", async () => {
    const page = makeQueuedFakePage([{ data: [{ id: "league-1", name: "NPL VIC Men" }] }]);

    const result = await listLeagues(page, "tenant-id", "comp-1");

    expect(result).toEqual({
      ok: true,
      value: [{ id: "league-1", attributes: { name: "NPL VIC Men" } }],
    });
  });
});
