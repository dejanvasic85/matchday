// Source-agnostic constants shared across the crawler seam (sourceAdapter.ts, sourceRegistry.ts).
// `CrawlSource` selects which adapter a job runs against; it is intentionally distinct from
// @matchday/domain's `Source` (`"dribl" | "dribl_club_code"`), which tags `external_ref` rows —
// `dribl_club_code` is an identity-mapping detail, not something a caller selects on the CLI.

export const crawlSourceValue = {
  dribl: "dribl",
} as const;

export type CrawlSource = (typeof crawlSourceValue)[keyof typeof crawlSourceValue];
