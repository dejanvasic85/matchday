import { coastalClubs } from "#crawlers/coastal/roster.ts";
import { clubInitials, crestSvg } from "#crawlers/coastal/crest.ts";

describe("clubInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(clubInitials("Stadly United")).toBe("SU");
    expect(clubInitials("Port Meridian")).toBe("PM");
    expect(clubInitials("Coral Bay Wanderers")).toBe("CB");
  });

  it("drops a trailing club-type abbreviation, then falls back to two letters", () => {
    expect(clubInitials("Harbourside FC")).toBe("HA");
    expect(clubInitials("Silverwood SC")).toBe("SI");
    expect(clubInitials("Redgum Park SC")).toBe("RP");
    expect(clubInitials("Cape Rosella FC")).toBe("CR");
  });

  it("gives every roster club a distinct set of initials", () => {
    const initials = coastalClubs.map((club) => clubInitials(club.name));
    expect(new Set(initials).size).toBe(coastalClubs.length);
  });
});

describe("crestSvg", () => {
  it("draws the shield in the club's two colours with its initials", () => {
    const svg = crestSvg({ initials: "SU", color: "#0B7A3B", accent: "#FFFFFF" });
    expect(svg).toContain('fill="#0B7A3B"');
    expect(svg).toContain('stroke="#FFFFFF"');
    expect(svg).toContain(">SU</text>");
  });

  it("returns the same bytes for the same club every time", () => {
    const input = { initials: "RP", color: "#B91C1C", accent: "#FDE68A" };
    expect(crestSvg(input)).toBe(crestSvg(input));
  });

  it("emits a complete SVG document", () => {
    const svg = crestSvg({ initials: "HA", color: "#0B4F9E", accent: "#F2C200" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });
});
