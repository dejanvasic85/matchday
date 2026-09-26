// API integration tests: the real Hono app against a real Neon branch, over the real
// neon-http driver. They run only when INTEGRATION_DATABASE_URL is set — CI points it at the
// PR's `pr-<number>` branch — so a normal `vp test` run, with no database, skips them.

import { createDbClient, insertApiToken, upsertClientByName, upsertClub } from "@matchday/db";
import { generateApiToken, generateId, hashApiToken } from "@matchday/domain";
import { z } from "zod";
import app from "#api.ts";

const databaseUrl = process.env["INTEGRATION_DATABASE_URL"];

const healthSchema = z.object({ status: z.literal("ok") });
const clubPageSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string() })),
  nextCursor: z.string().nullable(),
});

function testEnv(url: string) {
  return { DATABASE_URL: url, ENVIRONMENT: "development" };
}

// edgeCache reads `caches.default` and calls `executionCtx.waitUntil`; neither exists in Node,
// so an integration run supplies both. The cache itself is unit-tested; here it just must not
// break the request path.
function testExecutionCtx() {
  return { waitUntil: () => undefined, passThroughOnException: () => undefined, props: {} };
}

async function request(path: string, url: string, token?: string): Promise<Response> {
  const headers = token === undefined ? undefined : { Authorization: `Bearer ${token}` };
  return app.request(path, { headers }, testEnv(url), testExecutionCtx());
}

if (databaseUrl === undefined) {
  it.skip("needs INTEGRATION_DATABASE_URL to run", () => undefined);
} else {
  describe("API integration (real Neon branch)", () => {
    const db = createDbClient(databaseUrl);
    const clubId = generateId("club");
    // Unique per run, so re-running against the same branch never collides with leftover rows.
    const suffix = clubId.slice(-8);
    const clubName = `Integration Club ${suffix}`;
    const token = generateApiToken();

    beforeAll(async () => {
      vi.stubGlobal("caches", {
        default: { match: async () => undefined, put: async () => undefined },
      });

      const client = await upsertClientByName(db, {
        id: generateId("client"),
        name: `integration-${suffix}`,
      });
      if (!client.ok) throw new Error(client.error.message);

      const inserted = await insertApiToken(db, {
        id: generateId("apiToken"),
        clientId: client.value.id,
        tokenHash: await hashApiToken(token),
      });
      if (!inserted.ok) throw new Error(inserted.error.message);

      const club = await upsertClub(db, { id: clubId, name: clubName, displayName: clubName });
      if (!club.ok) throw new Error(club.error.message);
    });

    afterAll(() => {
      vi.unstubAllGlobals();
    });

    it("reports healthy when the branch is reachable", async () => {
      const res = await request("/health", databaseUrl);

      expect(res.status).toBe(200);
      expect(healthSchema.parse(await res.json())).toEqual({ status: "ok" });
    });

    it("serves a seeded club to an authenticated caller", async () => {
      const res = await request(`/clubs?name=${suffix}`, databaseUrl, token);

      expect(res.status).toBe(200);
      const page = clubPageSchema.parse(await res.json());
      expect(page.data.map((club) => club.id)).toContain(clubId);
    });

    it("rejects a caller with no token", async () => {
      const res = await request("/clubs", databaseUrl);

      expect(res.status).toBe(401);
    });
  });
}
