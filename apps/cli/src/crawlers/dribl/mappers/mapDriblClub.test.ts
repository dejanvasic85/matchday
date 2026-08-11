import type { DriblClub } from "#crawlers/dribl/external/driblClub.ts";
import { mapDriblClub } from "#crawlers/dribl/mappers/mapDriblClub.ts";

function makeDriblClub(overrides: Partial<DriblClub["attributes"]> = {}): DriblClub {
  return {
    type: "clubs",
    id: "am1409RY6d",
    attributes: {
      name: "Altona North SC",
      image: "https://ocean.dribl.com/f87efaf54d9c4c2696c327078ccdc7e7",
      email: "info@altonanorth.com.au",
      email_address: null,
      url: "https://altonanorth.com.au",
      address: null,
      socials: null,
      color: null,
      accent: null,
      grounds: null,
      ...overrides,
    },
  };
}

describe("mapDriblClub", () => {
  it("maps a raw club to the mapped domain shape", () => {
    const result = mapDriblClub(makeDriblClub());

    expect(result).toEqual({
      sourceId: "am1409RY6d",
      name: "Altona North SC",
      displayName: "Altona North SC",
      logoUrl: "https://ocean.dribl.com/f87efaf54d9c4c2696c327078ccdc7e7",
      email: "info@altonanorth.com.au",
      website: "https://altonanorth.com.au",
      address: null,
      socials: null,
    });
  });

  it("formats a non-null address into a single string, skipping empty parts", () => {
    const club = makeDriblClub({
      address: {
        address_line_1: "1 Reserve Rd",
        address_line_2: null,
        city: "Altona North",
        state: "VIC",
        country: "Australia",
        postcode: "3025",
      },
    });

    const result = mapDriblClub(club);

    expect(result.address).toBe("1 Reserve Rd, Altona North, VIC, 3025");
  });

  it("maps socials array into a name-keyed record", () => {
    const club = makeDriblClub({
      socials: [
        { name: "facebook", value: "https://facebook.com/altonanorth" },
        { name: "instagram", value: "https://instagram.com/altonanorth" },
      ],
    });

    const result = mapDriblClub(club);

    expect(result.socials).toEqual({
      facebook: "https://facebook.com/altonanorth",
      instagram: "https://instagram.com/altonanorth",
    });
  });

  it("maps an empty socials array to null", () => {
    const club = makeDriblClub({ socials: [] });

    const result = mapDriblClub(club);

    expect(result.socials).toBeNull();
  });
});
