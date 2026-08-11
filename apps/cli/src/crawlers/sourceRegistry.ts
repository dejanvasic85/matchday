// Maps a `CrawlSource` to its `SourceAdapter`. A new source is a new adapter registered here —
// no other file in src/jobs or cli.ts needs to change.

import { crawlSourceValue, type CrawlSource } from "#crawlers/constants.ts";
import { driblAdapter } from "#crawlers/dribl/driblAdapter.ts";
import type { SourceAdapter } from "#crawlers/sourceAdapter.ts";

const registry: Record<CrawlSource, SourceAdapter> = {
  [crawlSourceValue.dribl]: driblAdapter,
};

export function getSourceAdapter(source: CrawlSource): SourceAdapter {
  return registry[source];
}
