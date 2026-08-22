// Stages permanent assets (club logos, 0004) to R2 — sibling of rawStorage.ts, which targets the
// separate 7-day-expiry raw-staging bucket. Same aws4fetch approach, but a binary PUT, not JSON.

import { ok, serverError, type Result } from "@matchday/domain";
import { AwsClient } from "aws4fetch";

export type AssetStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type AssetStorage = {
  putObject: (key: string, body: Uint8Array, contentType: string) => Promise<Result<void>>;
};

export function createR2AssetStorage(config: AssetStorageConfig): AssetStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const baseUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}`;

  return {
    async putObject(key, body, contentType) {
      try {
        const response = await client.fetch(`${baseUrl}/${key}`, {
          method: "PUT",
          body,
          headers: { "content-type": contentType },
        });
        if (!response.ok) {
          return serverError(`R2 PUT failed for ${key}: HTTP ${response.status}`);
        }
        return ok(undefined);
      } catch (cause) {
        return serverError(`R2 PUT failed for ${key}`, cause);
      }
    },
  };
}
