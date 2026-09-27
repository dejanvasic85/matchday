// A deterministic crest for a Coastal club: a shield in the club's two colours carrying its
// initials. Pure, so the same club always produces the same SVG bytes and the R2 mirror is stable.

/** Club-type abbreviations dropped before taking initials. Full words ("United", "Rovers") stay,
 * because they are what tells otherwise-similar club names apart. */
const abbreviationSuffixesValue = ["AFC", "FC", "SC"] as const;

const abbreviationSuffixes = new Set<string>(abbreviationSuffixesValue);

/** Two-letter initials: the first letter of the first two words, or the first two letters of a
 * single-word name. "Stadly United" -> SU, "Harbourside FC" -> HA, "Redgum Park SC" -> RP. */
export function clubInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => word.length > 0 && !abbreviationSuffixes.has(word.toUpperCase()));

  const [first, second] = words;
  if (first === undefined) {
    return "";
  }
  if (second === undefined) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
}

export type CrestInput = {
  initials: string;
  color: string;
  accent: string;
};

const shieldPath = "M50 4 L94 19 V58 C94 87 75 106 50 116 C25 106 6 87 6 58 V19 Z";

/** The crest SVG for one club. Colours come from the roster as hex strings, initials are A-Z, so
 * the output needs no escaping. */
export function crestSvg(input: CrestInput): string {
  const { initials, color, accent } = input;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="100" height="120">`,
    `<title>${initials}</title>`,
    `<path d="${shieldPath}" fill="${color}"/>`,
    `<path d="${shieldPath}" fill="none" stroke="${accent}" stroke-width="6"/>`,
    `<text x="50" y="74" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" `,
    `font-size="40" font-weight="700" fill="${accent}">${initials}</text>`,
    `</svg>`,
  ].join("");
}
