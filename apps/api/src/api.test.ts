// Locks in ADR 0013's last piece (#77): the doc-level `security` declaration covers routes added
// later (e.g. fixtures/table, #45) without each needing its own.

import { z } from "zod";
import app from "#api.ts";

const testEnv = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  ENVIRONMENT: "development",
};

// `res.json()` is untyped by nature (Fetch API) — parse the slice of the spec these tests assert
// on rather than casting.
const openApiDocSchema = z.object({
  components: z.object({ securitySchemes: z.record(z.string(), z.unknown()) }),
  security: z.array(z.record(z.string(), z.array(z.string()))),
  paths: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.unknown()))),
});

async function fetchOpenApiDoc() {
  const res = await app.request("/openapi.json", {}, testEnv);
  return openApiDocSchema.parse(await res.json());
}

describe("openapi.json", () => {
  it("declares the bearer auth scheme as the default security requirement", async () => {
    const doc = await fetchOpenApiDoc();

    expect(doc.components.securitySchemes).toEqual({
      bearerAuth: { type: "http", scheme: "bearer", description: expect.any(String) },
    });
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
  });

  it("includes the fixtures/table routes, inheriting the default security requirement", async () => {
    const doc = await fetchOpenApiDoc();

    for (const path of ["/leagues/{id}/fixtures", "/leagues/{id}/table"]) {
      const operation = doc.paths[path]?.get;
      expect(operation).toBeDefined();
      expect(operation).not.toHaveProperty("security");
    }
  });
});

describe("auth wiring", () => {
  it("rejects a protected route with no Authorization header", async () => {
    const res = await app.request("/leagues", {}, testEnv);

    expect(res.status).toBe(401);
  });
});
