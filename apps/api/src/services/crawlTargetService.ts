// Wires the shared crawl-target service to a live `db`; the logic lives in @matchday/services.

import {
  getLeagueById,
  listCrawlTargetLeagueCandidates,
  upsertCrawlTarget,
  type Db,
} from "@matchday/db";
import type { CrawlTargetServiceDeps } from "@matchday/services";

export function createCrawlTargetServiceDeps(db: Db): CrawlTargetServiceDeps {
  return {
    getLeagueById: (id) => getLeagueById(db, id),
    upsertCrawlTarget: (input) => upsertCrawlTarget(db, input),
    listCrawlTargetLeagueCandidates: () => listCrawlTargetLeagueCandidates(db),
  };
}
