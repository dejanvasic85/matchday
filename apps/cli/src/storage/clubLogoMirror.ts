// Self-hosts a club's logo on R2 instead of hotlinking Dribl's CDN (ADR 0004) — content-hash
// keyed object names give idempotent re-upload for free (unchanged logo = no-op PUT).

import { createHash } from "node:crypto";
import { ok, type ClubId, type Result } from "@matchday/domain";
import type { AssetStorage } from "#storage/assetStorage.ts";

export type DownloadedImage = {
  bytes: Uint8Array;
  contentType: string;
};

export type MirrorClubLogoInput = {
  assetStorage: AssetStorage;
  /** DI'd so tests don't depend on network access; the real implementation is a plain `fetch()`
   * against Dribl's image CDN — confirmed reachable without Cloudflare's browser-clearance dance. */
  downloadImage: (url: string) => Promise<Result<DownloadedImage>>;
  clubId: ClubId;
  currentLogoUrl: string | null;
  sourceLogoUrl: string | null;
  publicAssetsBaseUrl: string;
};

const extensionByContentType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function hashOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 8);
}

/** `null` when Dribl has no logo for this club — nothing to mirror. */
export async function mirrorClubLogo(input: MirrorClubLogoInput): Promise<Result<string | null>> {
  const {
    assetStorage,
    downloadImage,
    clubId,
    currentLogoUrl,
    sourceLogoUrl,
    publicAssetsBaseUrl,
  } = input;

  if (sourceLogoUrl === null) {
    return ok(null);
  }

  const downloaded = await downloadImage(sourceLogoUrl);
  if (!downloaded.ok) {
    return downloaded;
  }
  const { bytes, contentType } = downloaded.value;

  const hash = hashOf(bytes);
  const extension = extensionByContentType[contentType] ?? "png";
  const key = `logos/${clubId}-${hash}.${extension}`;
  const filename = `${clubId}-${hash}.${extension}`;

  // Already mirrored at this exact content hash — skip the PUT. Anchored to the filename segment
  // so an incidental hex-string collision elsewhere in the URL can't false-positive.
  if (currentLogoUrl !== null && currentLogoUrl.endsWith(filename)) {
    return ok(currentLogoUrl);
  }

  const uploaded = await assetStorage.putObject(key, bytes, contentType);
  if (!uploaded.ok) {
    return uploaded;
  }

  return ok(`${publicAssetsBaseUrl}/${key}`);
}
