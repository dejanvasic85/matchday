// The logo image for a Coastal club: Stadly United's real app icon, or a generated crest for the
// rest. Bytes plus content type match the shared logo mirror's `DownloadedImage`.

import { readFile } from "node:fs/promises";
import { ok, serverError, type Result } from "@matchday/domain";
import { clubInitials, crestSvg } from "#crawlers/coastal/crest.ts";
import type { CoastalClub } from "#crawlers/coastal/roster.ts";
import type { DownloadedImage } from "#storage/clubLogoMirror.ts";

const stadlyClubKey = "stadly-united";
const stadlyAssetUrl = new URL("./assets/stadly-united.png", import.meta.url);

const pngContentType = "image/png";
const svgContentType = "image/svg+xml";

export async function coastalClubLogo(club: CoastalClub): Promise<Result<DownloadedImage>> {
  if (club.key === stadlyClubKey) {
    try {
      const bytes = new Uint8Array(await readFile(stadlyAssetUrl));
      return ok({ bytes, contentType: pngContentType });
    } catch (cause) {
      return serverError("Failed to read the Stadly United logo asset", cause);
    }
  }

  const svg = crestSvg({
    initials: clubInitials(club.name),
    color: club.color,
    accent: club.accent,
  });
  return ok({ bytes: new TextEncoder().encode(svg), contentType: svgContentType });
}
