import { crawlSourceValue } from "#crawlers/constants.ts";
import { driblAdapter } from "#crawlers/dribl/driblAdapter.ts";
import { getSourceAdapter } from "#crawlers/sourceRegistry.ts";

describe("getSourceAdapter", () => {
  it("resolves the dribl adapter for the dribl source", () => {
    expect(getSourceAdapter(crawlSourceValue.dribl)).toBe(driblAdapter);
  });
});
