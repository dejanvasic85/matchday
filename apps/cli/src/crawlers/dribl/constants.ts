export const crawlerConfigValue = {
  driblApiBase: "https://mc-api.dribl.com/api",
  // Loading tenantSiteUrl establishes Cloudflare clearance for mc-api.dribl.com calls. Not
  // secret — a public site URL, so it's a constant rather than env/CliConfig.
  tenantSlug: "fv",
  tenantSiteUrl: "https://fv.dribl.com/",
  defaultTimezone: "Australia/Melbourne",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 720 },
  clearanceWaitMs: 3000,
} as const;
