// `CrawlSource` selects which adapter a job runs against; distinct from @matchday/domain's
// `Source`, which tags `external_ref` rows and isn't something a caller selects on the CLI.

export const crawlSourceValue = {
  dribl: "dribl",
} as const;

export type CrawlSource = (typeof crawlSourceValue)[keyof typeof crawlSourceValue];
