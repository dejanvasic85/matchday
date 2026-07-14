import { generateId, idPrefixValue, isIdOfType, parseId } from "./id.ts";

describe("generateId", () => {
  it.each(Object.entries(idPrefixValue))(
    "generates a %s id with the %s_ prefix",
    (entityType, prefix) => {
      const id = generateId(entityType as keyof typeof idPrefixValue);

      expect(id.startsWith(`${prefix}_`)).toBe(true);
    },
  );

  it("generates a unique suffix on each call", () => {
    const first = generateId("club");
    const second = generateId("club");

    expect(first).not.toEqual(second);
  });

  it("generates a suffix using only the expected alphabet", () => {
    const id = generateId("club");
    const suffix = id.slice("clb_".length);

    expect(suffix).toMatch(/^[0-9A-Za-z]{12}$/);
  });
});

describe("isIdOfType", () => {
  it("returns true when the prefix matches the entity type", () => {
    expect(isIdOfType("clb_abc123", "club")).toBe(true);
  });

  it("returns false when the prefix does not match the entity type", () => {
    expect(isIdOfType("tea_abc123", "club")).toBe(false);
  });
});

describe("parseId", () => {
  it("returns the branded id when the prefix matches", () => {
    const raw = "clb_abc123";

    expect(parseId(raw, "club")).toEqual(raw);
  });

  it("returns undefined when the prefix does not match", () => {
    expect(parseId("tea_abc123", "club")).toBeUndefined();
  });
});
