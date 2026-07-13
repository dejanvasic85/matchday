import { createDbClient } from "./client.ts";

describe("createDbClient", () => {
  it("builds a Drizzle client from a connection string without connecting", () => {
    const db = createDbClient("postgres://user:pass@host/db");

    // The neon-http driver is lazy — constructing the client makes no network call. We only
    // assert a usable client with a query builder came back.
    expect(typeof db.select).toBe("function");
  });
});
