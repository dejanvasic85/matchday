import { ok } from "@matchday/domain";
import type { RawStorage } from "@/src/crawler/rawStorage.ts";

export function makeFakeRawStorage(): RawStorage & { puts: Array<{ key: string; body: unknown }> } {
  const puts: Array<{ key: string; body: unknown }> = [];
  return {
    puts,
    putJson: (key, body) => {
      puts.push({ key, body });
      return Promise.resolve(ok(undefined));
    },
  };
}
