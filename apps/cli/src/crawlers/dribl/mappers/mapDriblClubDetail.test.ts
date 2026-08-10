import type { DriblClubDetail } from "#crawlers/dribl/external/driblClub.ts";
import { mapDriblClubDetail } from "#crawlers/dribl/mappers/mapDriblClubDetail.ts";

function makeDriblClubDetail(
  overrides: Partial<DriblClubDetail["attributes"]> = {},
): DriblClubDetail {
  return {
    type: "clubs",
    id: "3vmZv3YLmq",
    attributes: {
      name: "Aintree SC",
      image: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
      email: "aintreesc@gmail.com",
      email_address: "aintreesc@gmail.com",
      url: null,
      address: null,
      socials: null,
      color: "#F15828",
      accent: "#FFFFFF",
      store: "/club/9294",
      grounds: {
        name: "Aintree North Recreation Reserve",
        address: "2 Recreation Rd, Aintree VIC 3336",
      },
      ...overrides,
    },
  };
}

describe("mapDriblClubDetail", () => {
  it("maps a raw club detail to the mapped domain shape", () => {
    const result = mapDriblClubDetail(makeDriblClubDetail());

    expect(result).toEqual({
      sourceId: "3vmZv3YLmq",
      name: "Aintree SC",
      displayName: "Aintree SC",
      logoUrl: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
      email: "aintreesc@gmail.com",
      website: null,
      address: null,
      socials: null,
      grounds: {
        name: "Aintree North Recreation Reserve",
        address: "2 Recreation Rd, Aintree VIC 3336",
      },
      color: "#F15828",
      accent: "#FFFFFF",
      store: "/club/9294",
    });
  });

  it("falls back to email_address when email is null", () => {
    const club = makeDriblClubDetail({ email: null, email_address: "info@club.example" });

    const result = mapDriblClubDetail(club);

    expect(result.email).toBe("info@club.example");
  });

  it("maps a null grounds (e.g. an admin pseudo-club) to null", () => {
    const club = makeDriblClubDetail({ grounds: null });

    const result = mapDriblClubDetail(club);

    expect(result.grounds).toBeNull();
  });

  it("maps a missing store key to null", () => {
    const club = makeDriblClubDetail({ store: undefined });

    const result = mapDriblClubDetail(club);

    expect(result.store).toBeNull();
  });
});
