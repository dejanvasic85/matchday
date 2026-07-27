import { crawlSourceValue } from "./constants.ts";
import { driblAdapter } from "./dribl/driblAdapter.ts";
import { getSourceAdapter } from "./sourceRegistry.ts";

describe("getSourceAdapter", () => {
  it("resolves the dribl adapter for the dribl source", () => {
    expect(getSourceAdapter(crawlSourceValue.dribl)).toBe(driblAdapter);
  });
});
