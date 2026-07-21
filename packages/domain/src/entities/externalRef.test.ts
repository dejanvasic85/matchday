import { externalRefSchema } from "./externalRef.ts";

function makeValidExternalRef() {
  return {
    id: "ext_abc123",
    entityType: "club",
    internalId: "clb_abc123",
    source: "dribl",
    sourceId: "d1e2a3d4-hash",
    sourceUrl: "https://ocean.dribl.com/logos/d1e2a3d4.png",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("externalRefSchema", () => {
  it("accepts a valid external ref", () => {
    const result = externalRefSchema.safeParse(makeValidExternalRef());

    expect(result.success).toBe(true);
  });

  it("accepts a null sourceUrl", () => {
    const result = externalRefSchema.safeParse({ ...makeValidExternalRef(), sourceUrl: null });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown entityType", () => {
    const result = externalRefSchema.safeParse({
      ...makeValidExternalRef(),
      entityType: "player",
    });

    expect(result.success).toBe(false);
  });

  it("accepts the dribl_club_code source", () => {
    const result = externalRefSchema.safeParse({
      ...makeValidExternalRef(),
      source: "dribl_club_code",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown source", () => {
    const result = externalRefSchema.safeParse({ ...makeValidExternalRef(), source: "playhq" });

    expect(result.success).toBe(false);
  });
});
