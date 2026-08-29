// Dribl-raw -> domain mapper (explicit named transform at the crawl boundary) for the
// richer `clubs/{id}` response — reuses mapDriblClub's address/socials formatting.

import type { Ground, Socials } from "@matchday/domain";
import type { DriblClubDetail } from "#crawlers/dribl/external/driblClub.ts";
import { formatAddress, formatSocials } from "#crawlers/dribl/mappers/mapDriblClub.ts";

export type MappedClubDetail = {
  sourceId: string;
  name: string;
  displayName: string;
  logoUrl: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  socials: Socials | null;
  grounds: Ground | null;
  color: string | null;
  accent: string | null;
  store: string | null;
};

export function mapDriblClubDetail(club: DriblClubDetail): MappedClubDetail {
  const { attributes } = club;

  return {
    sourceId: club.id,
    name: attributes.name,
    displayName: attributes.name,
    logoUrl: attributes.image,
    // `email_address` mirrors `email` once populated on clubs/{id}; fall back to it when `email`
    // itself is null rather than modelling a separate domain field for the same data.
    email: attributes.email ?? attributes.email_address,
    website: attributes.url,
    address: formatAddress(attributes.address),
    socials: formatSocials(attributes.socials),
    grounds: attributes.grounds,
    color: attributes.color,
    accent: attributes.accent,
    store: attributes.store ?? null,
  };
}
