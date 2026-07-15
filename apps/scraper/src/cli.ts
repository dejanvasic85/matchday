// CLI transport (AGENTS.md: thin glue). Each subcommand loads config, constructs the real
// collaborators (browser session, DB client, R2 raw storage, logger), calls a pure job service,
// and maps its Result to an exit code. No business logic lives here. Invoked by a human operator
// and by the scheduler (thanos cron / GH Actions / CF Cron) with the same command.

import { createDbClient } from "@matchday/db";
import { defineCommand } from "citty";
import { getScraperConfig } from "./config.ts";
import { openBrowserSession } from "./crawler/browserSession.ts";
import { createEntityResolutionDeps } from "./crawler/entityResolutionDeps.ts";
import { createR2RawStorage } from "./crawler/rawStorage.ts";
import { driblSiteUrl, driblTenantHost } from "./crawler/constants.ts";
import { createConsoleLogger } from "./logger.ts";
import { runClubsSync } from "./jobs/clubsSync.ts";

const clubsCommand = defineCommand({
  meta: { name: "clubs", description: "Crawl api/list/clubs and upsert clubs by external_ref." },
  async run() {
    const config = getScraperConfig();
    const logger = createConsoleLogger(config.LOG_LEVEL);
    const db = createDbClient(config.DATABASE_URL);
    const rawStorage = createR2RawStorage({
      accountId: config.R2_ACCOUNT_ID,
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucketName: config.R2_RAW_BUCKET_NAME,
    });

    const session = await openBrowserSession({
      driblSiteUrl: driblSiteUrl(config.DRIBL_TENANT_SLUG),
      browserWsEndpoint: config.BROWSER_WS_ENDPOINT,
    });
    if (!session.ok) {
      logger.error("crawl.clubs", "failed to open browser session", {
        error: session.error.message,
      });
      process.exitCode = 1;
      return;
    }

    try {
      const result = await runClubsSync({
        page: session.value.page,
        rawStorage,
        resolution: createEntityResolutionDeps(db),
        logger,
        tenantSlug: config.DRIBL_TENANT_SLUG,
        driblSiteHost: driblTenantHost(config.DRIBL_TENANT_SLUG),
        crawlRunId: new Date().toISOString().replaceAll(":", "-"),
      });
      if (!result.ok) {
        logger.error("crawl.clubs", "clubs sync failed", { error: result.error.message });
        process.exitCode = 1;
        return;
      }
      if (result.value.failed > 0) {
        process.exitCode = 1;
      }
    } finally {
      await session.value.close();
    }
  },
});

export const mainCommand = defineCommand({
  meta: { name: "mday", description: "matchday scraper — Dribl crawl jobs." },
  subCommands: { clubs: clubsCommand },
});
