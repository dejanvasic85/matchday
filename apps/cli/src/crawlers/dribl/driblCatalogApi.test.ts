import { makeQueuedFakePage } from "#test/fixtures/fakePage.ts";
import {
  listClubs,
  listCompetitions,
  listLeagues,
  listSeasons,
  resolveTenantId,
} from "#crawlers/dribl/driblCatalogApi.ts";

describe("resolveTenantId", () => {
  it("resolves the tenant id from the tenants response", async () => {
    const page = makeQueuedFakePage([{ data: { id: "tenant-id" } }]);

    const result = await resolveTenantId(page, "fv.dribl.com", "fv");

    expect(result).toEqual({ ok: true, value: "tenant-id" });
  });

  it("returns err on an invalid tenants response", async () => {
    const page = makeQueuedFakePage([{ data: {} }]);

    const result = await resolveTenantId(page, "fv.dribl.com", "fv");

    assert(!result.ok);
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

function makeClubListAttributes() {
  return {
    name: "Aintree SC",
    image: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
    email: "aintreesc@gmail.com",
    email_address: null,
    url: null,
    color: null,
    accent: null,
    address: null,
    socials: null,
    grounds: null,
  };
}

describe("listClubs", () => {
  it("returns every club, including admin pseudo-clubs (unfiltered)", async () => {
    const page = makeQueuedFakePage([
      {
        data: [
          { type: "clubs", id: "3vmZv3YLmq", attributes: makeClubListAttributes() },
          {
            type: "clubs",
            id: "RwNl35aZmj",
            attributes: { ...makeClubListAttributes(), name: "FV Albury Wodonga Referees" },
          },
        ],
      },
    ]);

    const result = await listClubs(page, "tenant-id");

    assert(result.ok);
    expect(result.value.map((club) => club.attributes.name)).toEqual([
      "Aintree SC",
      "FV Albury Wodonga Referees",
    ]);
  });

  it("returns err on an invalid list/clubs response", async () => {
    const page = makeQueuedFakePage([{ data: [{ type: "clubs" }] }]);

    const result = await listClubs(page, "tenant-id");

    assert(!result.ok);
  });
});
