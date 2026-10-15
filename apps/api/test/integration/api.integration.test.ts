// API integration tests: the real Hono app against a real Neon branch, over the real
// neon-http driver. They run only when INTEGRATION_DATABASE_URL is set — CI points it at the
// PR's `pr-<number>` branch — so a normal `vp test` run, with no database, skips them.

import {
  createDbClient,
  deleteCrawlTargetById,
  insertApiToken,
  listClientClubs,
  upsertClientByName,
  upsertClub,
  upsertCompetition,
  upsertLeague,
  upsertSeason,
} from "@matchday/db";
import { generateApiToken, generateId, hashApiToken } from "@matchday/domain";
import { z } from "zod";
import app from "#api.ts";

const databaseUrl = process.env["INTEGRATION_DATABASE_URL"];

const healthSchema = z.object({ status: z.literal("ok") });
const followSchema = z.object({
  clubId: z.string(),
  webhookUrl: z.string(),
  webhookSecret: z.string().min(1),
});
const crawlTargetSchema = z.object({
  id: z.string(),
  competitionId: z.string(),
  leagueName: z.string(),
  currentLeagueId: z.string().nullable(),
});
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

async function request(
  path: string,
  url: string,
  token?: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers = {
    ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    ...(init.body === undefined ? {} : { "content-type": "application/json" }),
  };
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  return app.request(
    path,
    { method: init.method, headers, body },
    testEnv(url),
    testExecutionCtx(),
  );
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
    const leagueId = generateId("league");
    const competitionId = generateId("competition");
    const leagueName = `Integration League ${suffix}`;
    const webhookUrl = "https://hooks.example.com/matchday";
    const clientId = generateId("client");
    let crawlTargetId: string | undefined;

    beforeAll(async () => {
      vi.stubGlobal("caches", {
        default: { match: async () => undefined, put: async () => undefined },
      });

      const client = await upsertClientByName(db, {
        id: clientId,
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

      const seededCompetition = await upsertCompetition(db, {
        id: competitionId,
        name: `Integration Competition ${suffix}`,
      });
      if (!seededCompetition.ok) throw new Error(seededCompetition.error.message);

      const seededSeason = await upsertSeason(db, {
        id: generateId("season"),
        source: "dribl",
        name: `Integration Season ${suffix}`,
      });
      if (!seededSeason.ok) throw new Error(seededSeason.error.message);

      const seededLeague = await upsertLeague(db, {
        id: leagueId,
        name: leagueName,
        competitionId,
        seasonId: seededSeason.value.id,
      });
      if (!seededLeague.ok) throw new Error(seededLeague.error.message);
    });

    afterAll(async () => {
      vi.unstubAllGlobals();
      if (crawlTargetId !== undefined) {
        await deleteCrawlTargetById(db, crawlTargetId);
      }
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

    describe("following a club", () => {
      const followPath = `/clubs/${clubId}/follow`;

      async function storedFollow() {
        const follows = await listClientClubs(db);
        if (!follows.ok) throw new Error(follows.error.message);
        return follows.value.find((f) => f.clientId === clientId && f.clubId === clubId);
      }

      it("rejects a follow with no token", async () => {
        const res = await request(followPath, databaseUrl, undefined, {
          method: "POST",
          body: { webhookUrl },
        });

        expect(res.status).toBe(401);
      });

      it("rejects a webhook that is not a public https host", async () => {
        const res = await request(followPath, databaseUrl, token, {
          method: "POST",
          body: { webhookUrl: "http://localhost:3000/hook" },
        });

        expect(res.status).toBe(400);
      });

      it("returns 404 when following an unknown club", async () => {
        const res = await request("/clubs/clb_doesNotExist/follow", databaseUrl, token, {
          method: "POST",
          body: { webhookUrl },
        });

        expect(res.status).toBe(404);
      });

      it("follows a club, storing the webhook and returning its secret once", async () => {
        const res = await request(followPath, databaseUrl, token, {
          method: "POST",
          body: { webhookUrl },
        });

        expect(res.status).toBe(200);
        expect(followSchema.parse(await res.json())).toMatchObject({ clubId, webhookUrl });
        expect((await storedFollow())?.webhookUrl).toBe(webhookUrl);
      });

      it("issues a new secret when the club is followed again", async () => {
        const first = followSchema.parse(
          await (
            await request(followPath, databaseUrl, token, { method: "POST", body: { webhookUrl } })
          ).json(),
        );
        const second = followSchema.parse(
          await (
            await request(followPath, databaseUrl, token, { method: "POST", body: { webhookUrl } })
          ).json(),
        );

        expect(second.webhookSecret).not.toBe(first.webhookSecret);
      });

      it("unfollows the club, then returns 404 when it is not followed", async () => {
        await request(followPath, databaseUrl, token, { method: "POST", body: { webhookUrl } });
        const removed = await request(followPath, databaseUrl, token, { method: "DELETE" });
        const again = await request(followPath, databaseUrl, token, { method: "DELETE" });

        expect(removed.status).toBe(204);
        expect(await storedFollow()).toBeUndefined();
        expect(again.status).toBe(404);
      });
    });

    describe("adding a crawl target", () => {
      const targetPath = `/leagues/${leagueId}/crawl-target`;

      it("rejects an add with no token", async () => {
        const res = await request(targetPath, databaseUrl, undefined, { method: "PUT" });

        expect(res.status).toBe(401);
      });

      it("returns 404 for an unknown league", async () => {
        const res = await request("/leagues/lea_doesNotExist/crawl-target", databaseUrl, token, {
          method: "PUT",
        });

        expect(res.status).toBe(404);
      });

      it("adds the target, and adding it again returns the same one", async () => {
        const first = await request(targetPath, databaseUrl, token, { method: "PUT" });
        const target = crawlTargetSchema.parse(await first.json());
        crawlTargetId = target.id;
        const second = await request(targetPath, databaseUrl, token, { method: "PUT" });

        expect(first.status).toBe(200);
        expect(target).toMatchObject({ competitionId, leagueName });
        expect(crawlTargetSchema.parse(await second.json()).id).toBe(target.id);
      });
    });
  });
}
