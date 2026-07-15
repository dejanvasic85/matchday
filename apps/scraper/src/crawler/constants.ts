export const crawlerConfigValue = {
  driblApiBase: "https://mc-api.dribl.com/api",
  defaultTimezone: "Australia/Melbourne",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 720 },
  clearanceWaitMs: 3000,
} as const;

/** A tenant's public Dribl host, e.g. "fv.dribl.com" — the `mc_link` param and clearance origin. */
export function driblTenantHost(tenantSlug: string): string {
  return `${tenantSlug}.dribl.com`;
}

/** The page the browser visits to obtain Cloudflare clearance before any API call. */
export function driblSiteUrl(tenantSlug: string): string {
  return `https://${driblTenantHost(tenantSlug)}/fixtures/`;
}
