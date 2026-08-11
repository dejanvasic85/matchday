import {
  driblClubDetailApiResponseSchema,
  driblClubSocialSchema,
} from "#crawlers/dribl/external/driblClub.ts";

describe("driblClubSocialSchema", () => {
  it("accepts a known platform name", () => {
    const result = driblClubSocialSchema.safeParse({
      name: "facebook",
      value: "https://facebook.com/altonanorth",
    });

    expect(result.success).toBe(true);
  });

  it("tolerates a platform name Dribl hasn't sent before", () => {
    const result = driblClubSocialSchema.safeParse({
      name: "tiktok",
      value: "https://tiktok.com/@altonanorth",
    });

    expect(result.success).toBe(true);
  });
});

function makeDriblClubDetailAttributes() {
  return {
    name: "Aintree SC",
    image: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
    email: "aintreesc@gmail.com",
    email_address: "aintreesc@gmail.com",
    url: null,
    color: "#F15828",
    accent: "#FFFFFF",
    address: {
      address_line_1: "2 Recreation Road",
      address_line_2: null,
      city: "Aintree",
      state: "VIC",
      country: "AUS",
      postcode: "3336",
    },
    socials: [
      { name: "facebook", value: "https://www.facebook.com/profile.php?id=100076200432306" },
    ],
    store: "/club/9294",
    grounds: {
      name: "Aintree North Recreation Reserve",
      address: "2 Recreation Rd, Aintree VIC 3336",
    },
  };
}

describe("driblClubDetailApiResponseSchema", () => {
  it("accepts a real clubs/{id} response shape (single `data` object, not an array)", () => {
    const result = driblClubDetailApiResponseSchema.safeParse({
      data: { type: "clubs", id: "3vmZv3YLmq", attributes: makeDriblClubDetailAttributes() },
    });

    expect(result.success).toBe(true);
  });

  it("accepts an admin pseudo-club with grounds/color nulled out", () => {
    const result = driblClubDetailApiResponseSchema.safeParse({
      data: {
        type: "clubs",
        id: "RwNl35aZmj",
        attributes: { ...makeDriblClubDetailAttributes(), grounds: null, socials: [] },
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a club whose response omits the store key entirely", () => {
    const attributes = makeDriblClubDetailAttributes();
    const { store: _store, ...attributesWithoutStore } = attributes;

    const result = driblClubDetailApiResponseSchema.safeParse({
      data: { type: "clubs", id: "b8Nqgnnd9M", attributes: attributesWithoutStore },
    });

    expect(result.success).toBe(true);
  });
});
