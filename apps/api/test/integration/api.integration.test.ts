// API integration tests: the real Hono app against a real Neon branch, over the real
// neon-http driver. They run only when INTEGRATION_DATABASE_URL is set — CI points it at the
// PR's `pr-<number>` branch — so a normal `vp test` run, with no database, skips them.

import {
  createDbClient,
  type Db,
  deleteCrawlTargetById,
  insertApiToken,
  listClientClubs,
  listCrawlTargetLeagueCandidates,
  upsertClientByName,
  upsertClub,
  upsertCompetition,
  upsertExternalRef,
  upsertLeague,
  upsertSeason,
} from "@matchday/db";
import {
  generateApiToken,
  generateId,
  hashApiToken,
  todayInMelbourne,
  type Result,
} from "@matchday/domain";
import { resolveCrawlScope } from "@matchday/services";
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

function valueOrThrow<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

type LeagueSeed = {
  competitionId: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  source: "dribl" | "coastal";
  sourceId: string;
};

/** A competition, a league in it, and the one source ref that says which crawl owns the league. */
async function seedLeague(db: Db, seed: LeagueSeed): Promise<void> {
  valueOrThrow(
    await upsertCompetition(db, {
      id: seed.competitionId,
      name: `${seed.leagueName} competition`,
    }),
  );
  valueOrThrow(
    await upsertLeague(db, {
      id: seed.leagueId,
      name: seed.leagueName,
      competitionId: seed.competitionId,
      seasonId: seed.seasonId,
    }),
  );
  valueOrThrow(
    await upsertExternalRef(db, {
      id: generateId("externalRef"),
      entityType: "league",
      internalId: seed.leagueId,
      source: seed.source,
      sourceId: seed.sourceId,
    }),
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
    const coastalLeagueId = generateId("league");
    const coastalCompetitionId = generateId("competition");
    const leagueName = `Integration League ${suffix}`;
    const webhookUrl = "https://hooks.example.com/matchday";
    const clientId = generateId("client");
    const crawlTargetIds: string[] = [];

    beforeAll(async () => {
      vi.stubGlobal("caches", {
        default: { match: async () => undefined, put: async () => undefined },
      });

      const client = valueOrThrow(
        await upsertClientByName(db, { id: clientId, name: `integration-${suffix}` }),
      );
      valueOrThrow(
        await insertApiToken(db, {
          id: generateId("apiToken"),
          clientId: client.id,
          tokenHash: await hashApiToken(token),
        }),
      );
      valueOrThrow(await upsertClub(db, { id: clubId, name: clubName, displayName: clubName }));

      const seededSeason = valueOrThrow(
        await upsertSeason(db, {
          id: generateId("season"),
          source: "dribl",
          name: `Integration Season ${suffix}`,
        }),
      );
      await seedLeague(db, {
        competitionId,
        leagueId,
        leagueName,
        seasonId: seededSeason.id,
        source: "dribl",
        sourceId: `integration-dribl-${suffix}`,
      });
      await seedLeague(db, {
        competitionId: coastalCompetitionId,
        leagueId: coastalLeagueId,
        leagueName: `Integration Coastal League ${suffix}`,
        seasonId: seededSeason.id,
        source: "coastal",
        sourceId: `integration-coastal-${suffix}`,
      });
    });

    afterAll(async () => {
      vi.unstubAllGlobals();
      for (const id of crawlTargetIds) {
        await deleteCrawlTargetById(db, id);
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
        crawlTargetIds.push(target.id);
        const second = await request(targetPath, databaseUrl, token, { method: "PUT" });

        expect(first.status).toBe(200);
        expect(target).toMatchObject({ competitionId, leagueName, currentLeagueId: leagueId });
        expect(crawlTargetSchema.parse(await second.json()).id).toBe(target.id);
      });

      it("adds a league from another source, which names its own league", async () => {
        const res = await request(`/leagues/${coastalLeagueId}/crawl-target`, databaseUrl, token, {
          method: "PUT",
        });

        const target = crawlTargetSchema.parse(await res.json());
        crawlTargetIds.push(target.id);
        expect(res.status).toBe(200);
        expect(target.currentLeagueId).toBe(coastalLeagueId);
      });

      it("gives each source's crawl only its own leagues from the shared targets", async () => {
        for (const id of [leagueId, coastalLeagueId]) {
          const res = await request(`/leagues/${id}/crawl-target`, databaseUrl, token, {
            method: "PUT",
          });
          crawlTargetIds.push(crawlTargetSchema.parse(await res.json()).id);
        }
        const deps = { listCrawlTargetLeagueCandidates: () => listCrawlTargetLeagueCandidates(db) };

        const dribl = valueOrThrow(await resolveCrawlScope(deps, todayInMelbourne(), "dribl"));
        const coastal = valueOrThrow(await resolveCrawlScope(deps, todayInMelbourne(), "coastal"));

        expect(dribl.leagueIds).toContain(leagueId);
        expect(dribl.leagueIds).not.toContain(coastalLeagueId);
        expect(coastal.leagueIds).toContain(coastalLeagueId);
        expect(coastal.leagueIds).not.toContain(leagueId);
      });
    });
  });
}
