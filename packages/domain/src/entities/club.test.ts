import { clubSchema, groundSchema } from "./club.ts";

function makeValidClub() {
  return {
    id: "clb_abc123",
    name: "Williamstown SC",
    displayName: "Williamstown",
    logoUrl: "https://assets.matchday.dev/clb_abc123.png",
    email: "info@wsc.example",
    website: "https://wsc.example",
    address: "1 Ferguson St, Williamstown",
    socials: { facebook: "https://facebook.com/wsc" },
    grounds: { name: "Fearon Reserve", address: "1 Ferguson St, Williamstown" },
    color: "#093161",
    accent: "#FFFFFF",
    store: "/club/9294",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("clubSchema", () => {
  it("accepts a fully-populated club", () => {
    const result = clubSchema.safeParse(makeValidClub());

    expect(result.success).toBe(true);
  });

  it("accepts nullable fields set to null", () => {
    const result = clubSchema.safeParse({
      ...makeValidClub(),
      logoUrl: null,
      email: null,
      website: null,
      address: null,
      socials: null,
      grounds: null,
      color: null,
      accent: null,
      store: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a club missing a required field", () => {
    const { name: _name, ...withoutName } = makeValidClub();

    const result = clubSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });
});

describe("groundSchema", () => {
  it("accepts a ground with a nullable address", () => {
    const result = groundSchema.safeParse({ name: "Fearon Reserve", address: null });

    expect(result.success).toBe(true);
  });
});
