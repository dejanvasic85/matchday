// Stages raw Dribl API responses to Cloudflare R2 pre-transform (0004), via aws4fetch — a
// fetch-native SigV4 signer with no Node-specific dependencies, so this client works unchanged
// whether the scraper runs on thanos (Node) or is ever split onto a Worker-compatible runtime.

import { err, ok, type Result } from "@matchday/domain";
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
          return err({ message: `R2 PUT failed for ${key}: HTTP ${response.status}` });
        }
        return ok(undefined);
      } catch (cause) {
        return err({ message: `R2 PUT failed for ${key}`, cause });
      }
    },
  };
}
