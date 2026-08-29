// Stages a source's raw API responses to R2 pre-transform, via aws4fetch (fetch-native
// SigV4, no Node-specific deps) so it works unchanged on Node or a Worker runtime. Source-agnostic.

import { ok, serverError, type Result } from "@matchday/domain";
import { AwsClient } from "aws4fetch";

export type RawStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type RawStorage = {
  putJson: (key: string, body: unknown) => Promise<Result<void>>;
};

export function createR2RawStorage(config: RawStorageConfig): RawStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const baseUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}`;

  return {
    async putJson(key, body) {
      try {
        const response = await client.fetch(`${baseUrl}/${key}`, {
          method: "PUT",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
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
