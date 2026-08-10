import { ok, serverError, type ClubId, type Result } from "@matchday/domain";
import { mirrorClubLogo, type DownloadedImage } from "./clubLogoMirror.ts";

const clubId = "clb_existing0001" as ClubId;

function makeFakeAssetStorage() {
  const puts: Array<{ key: string; contentType: string }> = [];
  return {
    puts,
    putObject: vi.fn(
      (key: string, _body: Uint8Array, contentType: string): Promise<Result<void>> => {
        puts.push({ key, contentType });
        return Promise.resolve(ok(undefined));
      },
    ),
  };
}

function makeDownloadImage(image: DownloadedImage): () => Promise<Result<DownloadedImage>> {
  return vi.fn().mockResolvedValue(ok(image));
}

const pngBytes = new Uint8Array([1, 2, 3, 4]);

describe("mirrorClubLogo", () => {
  it("returns null without downloading when there is no source logo", async () => {
    const assetStorage = makeFakeAssetStorage();
    const downloadImage = makeDownloadImage({ bytes: pngBytes, contentType: "image/png" });

    const result = await mirrorClubLogo({
      assetStorage,
      downloadImage,
      clubId,
      currentLogoUrl: null,
      sourceLogoUrl: null,
      publicAssetsBaseUrl: "https://assets.matchday.dev",
    });

    expect(result).toEqual({ ok: true, value: null });
    expect(downloadImage).not.toHaveBeenCalled();
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("downloads, hashes and uploads a new logo, returning the public R2 URL", async () => {
    const assetStorage = makeFakeAssetStorage();
    const downloadImage = makeDownloadImage({ bytes: pngBytes, contentType: "image/png" });

    const result = await mirrorClubLogo({
      assetStorage,
      downloadImage,
      clubId,
      currentLogoUrl: null,
      sourceLogoUrl: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
      publicAssetsBaseUrl: "https://assets.matchday.dev",
    });

    assert(result.ok);
    expect(result.value).toMatch(
      /^https:\/\/assets\.matchday\.dev\/logos\/clb_existing0001-[0-9a-f]{8}\.png$/,
    );
    expect(assetStorage.puts).toHaveLength(1);
    expect(assetStorage.puts[0]?.contentType).toBe("image/png");
  });

  it("skips the upload when the logo's hash already matches the current URL", async () => {
    const assetStorage = makeFakeAssetStorage();
    const downloadImage = makeDownloadImage({ bytes: pngBytes, contentType: "image/png" });
    const unchangedUrl = "https://assets.matchday.dev/logos/clb_existing0001-9f64a747.png";

    const result = await mirrorClubLogo({
      assetStorage,
      downloadImage,
      clubId,
      currentLogoUrl: unchangedUrl,
      sourceLogoUrl: "https://ocean.dribl.com/86f34bc0855a4f519dd696483def4a47",
      publicAssetsBaseUrl: "https://assets.matchday.dev",
    });

    expect(result).toEqual({ ok: true, value: unchangedUrl });
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("propagates a download failure", async () => {
    const assetStorage = makeFakeAssetStorage();
    const downloadImage = vi.fn().mockResolvedValue(serverError("network down"));

    const result = await mirrorClubLogo({
      assetStorage,
      downloadImage,
      clubId,
      currentLogoUrl: null,
      sourceLogoUrl: "https://ocean.dribl.com/logo",
      publicAssetsBaseUrl: "https://assets.matchday.dev",
    });

    assert(!result.ok);
    expect(assetStorage.putObject).not.toHaveBeenCalled();
  });

  it("propagates an upload failure", async () => {
    const assetStorage = makeFakeAssetStorage();
    assetStorage.putObject.mockResolvedValue(serverError("r2 down"));
    const downloadImage = makeDownloadImage({ bytes: pngBytes, contentType: "image/png" });

    const result = await mirrorClubLogo({
      assetStorage,
      downloadImage,
      clubId,
      currentLogoUrl: null,
      sourceLogoUrl: "https://ocean.dribl.com/logo",
      publicAssetsBaseUrl: "https://assets.matchday.dev",
    });

    assert(!result.ok);
  });
});
