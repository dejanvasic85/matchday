import { parseEnv } from "@matchday/domain";
import { z } from "zod";

/**
 * Scraper environment (Node `process.env`). Vars are documented in
 * `apps/scraper/.env.example`. Call `getScraperConfig()` once at startup.
 */
const scraperEnvSchema = z.object({
  // Neon Postgres — the scraper upserts crawled data by external_ref.
  DATABASE_URL: z.url(),
  // Dribl tenant the crawl targets (e.g. host prefix / slug).
  DRIBL_TENANT_SLUG: z.string().min(1),
  // The tenant's public Dribl site; one page load establishes Cloudflare clearance for all
  // subsequent mc-api.dribl.com calls (dribl-crawling skill).
  DRIBL_SITE_URL: z.url(),
  // playwright-core browser endpoint. Unset -> launch local Chrome (thanos primary);
  // set to a ws:// URL -> connect to a managed browser (fallback).
  BROWSER_WS_ENDPOINT: z.url().optional(),
  // Cloudflare R2 for mirroring club logos.
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  // Cloudflare R2 for staging raw Dribl API responses pre-transform (0004); bucket has a
  // 7-day lifecycle expiry, separate from the (permanent) logos bucket above.
  R2_RAW_BUCKET_NAME: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ScraperConfig = z.infer<typeof scraperEnvSchema>;

export function getScraperConfig(): ScraperConfig {
  return parseEnv(scraperEnvSchema, process.env);
}
