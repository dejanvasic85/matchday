// Dribl-raw -> domain mapper (0004: explicit named transform at the crawl boundary).

import type { Socials } from "@matchday/domain";
import type { DriblClub } from "../external/driblClub.ts";

export type MappedClub = {
  sourceId: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  socials: Socials | null;
};

export function formatAddress(address: DriblClub["attributes"]["address"]): string | null {
  if (address === null) {
    return null;
  }
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postcode,
  ];
  const formatted = parts.filter((part) => part !== null && part.length > 0).join(", ");
  return formatted.length > 0 ? formatted : null;
}

export function formatSocials(socials: DriblClub["attributes"]["socials"]): Socials | null {
  if (socials === null || socials.length === 0) {
    return null;
  }
  return Object.fromEntries(socials.map((social) => [social.name, social.value]));
}

export function mapDriblClub(club: DriblClub): MappedClub {
  const { attributes } = club;

  return {
    sourceId: club.id,
    name: attributes.name,
    displayName: attributes.name,
    logoUrl: attributes.image,
    email: attributes.email,
    website: attributes.url,
    address: formatAddress(attributes.address),
    socials: formatSocials(attributes.socials),
  };
}
