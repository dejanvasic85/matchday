// The Coastal Football Association roster: 20 clubs, one team each, kept across every season. A
// club's `key` is its stable identity inside the source — external refs are built from it, so it
// must not change between seasons. A club's `strength` is a fixed rating where 1 is league average;
// it gives the ladder a believable shape instead of a random shuffle. `color` and `accent` are the
// crest's two colours, written to the club row by enrichment.

import { z } from "zod";

const coastalClubSchema = z.object({
  /** Slug used in generated ids and external refs. Stable forever. */
  key: z.string(),
  name: z.string(),
  /** One senior team per club; the team name matches the club. */
  teamName: z.string(),
  ground: z.string(),
  /** Rating around 1.0. Higher clubs score more and concede less. */
  strength: z.number().positive(),
  /** Crest background, as a hex colour. */
  color: z.string(),
  /** Crest border and initials, as a hex colour. */
  accent: z.string(),
});

export type CoastalClub = z.infer<typeof coastalClubSchema>;

export const coastalClubs: readonly CoastalClub[] = [
  {
    key: "stadly-united",
    name: "Stadly United",
    teamName: "Stadly United",
    ground: "Stadly Park",
    strength: 1.35,
    color: "#0B7A3B",
    accent: "#FFFFFF",
  },
  {
    key: "harbourside",
    name: "Harbourside FC",
    teamName: "Harbourside FC",
    ground: "Harbourside Oval",
    strength: 1.28,
    color: "#0B4F9E",
    accent: "#F2C200",
  },
  {
    key: "kingsmere-rovers",
    name: "Kingsmere Rovers",
    teamName: "Kingsmere Rovers",
    ground: "Kingsmere Reserve",
    strength: 1.2,
    color: "#7A1F2B",
    accent: "#F5F5F5",
  },
  {
    key: "ashvale-city",
    name: "Ashvale City",
    teamName: "Ashvale City",
    ground: "Ashvale Fields",
    strength: 1.14,
    color: "#2E2E38",
    accent: "#E63946",
  },
  {
    key: "brookfield-athletic",
    name: "Brookfield Athletic",
    teamName: "Brookfield Athletic",
    ground: "Brookfield Sports Ground",
    strength: 1.08,
    color: "#14532D",
    accent: "#D4AF37",
  },
  {
    key: "redgum-park",
    name: "Redgum Park SC",
    teamName: "Redgum Park SC",
    ground: "Redgum Park",
    strength: 1.04,
    color: "#B91C1C",
    accent: "#FDE68A",
  },
  {
    key: "seaview-albion",
    name: "Seaview Albion",
    teamName: "Seaview Albion",
    ground: "Seaview Oval",
    strength: 1.0,
    color: "#0E7490",
    accent: "#FFFFFF",
  },
  {
    key: "coral-bay-wanderers",
    name: "Coral Bay Wanderers",
    teamName: "Coral Bay Wanderers",
    ground: "Coral Bay Oval",
    strength: 0.98,
    color: "#F97316",
    accent: "#1E3A8A",
  },
  {
    key: "elmstead-town",
    name: "Elmstead Town",
    teamName: "Elmstead Town",
    ground: "Elmstead Recreation Reserve",
    strength: 0.95,
    color: "#365314",
    accent: "#F5F5F5",
  },
  {
    key: "port-meridian",
    name: "Port Meridian",
    teamName: "Port Meridian",
    ground: "Meridian Park",
    strength: 0.93,
    color: "#1E3A8A",
    accent: "#F97316",
  },
  {
    key: "fernleigh-falcons",
    name: "Fernleigh Falcons",
    teamName: "Fernleigh Falcons",
    ground: "Fernleigh Reserve",
    strength: 0.9,
    color: "#4C1D95",
    accent: "#FACC15",
  },
  {
    key: "lighthouse-rovers",
    name: "Lighthouse Rovers",
    teamName: "Lighthouse Rovers",
    ground: "Beacon Hill Reserve",
    strength: 0.88,
    color: "#0369A1",
    accent: "#F8FAFC",
  },
  {
    key: "marlow-heights",
    name: "Marlow Heights",
    teamName: "Marlow Heights",
    ground: "Marlow Heights Reserve",
    strength: 0.86,
    color: "#831843",
    accent: "#FBCFE8",
  },
  {
    key: "dunmore-athletic",
    name: "Dunmore Athletic",
    teamName: "Dunmore Athletic",
    ground: "Dunmore Recreation Ground",
    strength: 0.84,
    color: "#3F3F46",
    accent: "#22C55E",
  },
  {
    key: "silverwood",
    name: "Silverwood SC",
    teamName: "Silverwood SC",
    ground: "Silverwood Sports Complex",
    strength: 0.82,
    color: "#64748B",
    accent: "#0F172A",
  },
  {
    key: "stonehaven-city",
    name: "Stonehaven City",
    teamName: "Stonehaven City",
    ground: "Stonehaven Stadium",
    strength: 0.8,
    color: "#1F2937",
    accent: "#38BDF8",
  },
  {
    key: "wattlebrook-united",
    name: "Wattlebrook United",
    teamName: "Wattlebrook United",
    ground: "Wattlebrook Reserve",
    strength: 0.79,
    color: "#92400E",
    accent: "#FEF3C7",
  },
  {
    key: "tidewater-rangers",
    name: "Tidewater Rangers",
    teamName: "Tidewater Rangers",
    ground: "Tidewater Reserve",
    strength: 0.78,
    color: "#0F766E",
    accent: "#FDE68A",
  },
  {
    key: "northgate-olympic",
    name: "Northgate Olympic",
    teamName: "Northgate Olympic",
    ground: "Northgate Park",
    strength: 0.76,
    color: "#1D4ED8",
    accent: "#FFFFFF",
  },
  {
    key: "cape-rosella",
    name: "Cape Rosella FC",
    teamName: "Cape Rosella FC",
    ground: "Rosella Point Reserve",
    strength: 0.74,
    color: "#BE123C",
    accent: "#FDE047",
  },
];

const clubsByKey = new Map(coastalClubs.map((club) => [club.key, club]));

/** The club behind a `key`, or `undefined` for an unknown one. */
export function findCoastalClub(key: string): CoastalClub | undefined {
  return clubsByKey.get(key);
}
