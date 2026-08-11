// Regenerates src/generated/schema.d.ts straight from the live OpenAPI doc — no committed spec
// file to drift from the routes it describes (mirrors apps/api not committing a static
// openapi.json either). Runs as part of `build`.

import { mkdir, writeFile } from "node:fs/promises";
import app from "@matchday/api";
import openapiTS, { astToString } from "openapi-typescript";

// Only used to satisfy ApiBindings validation for a request /openapi.json never actually reads —
// mirrors apps/api/src/index.test.ts's fake env.
const fakeApiBindings = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  ENVIRONMENT: "development",
};

async function generateClient() {
  const res = await app.request("/openapi.json", {}, fakeApiBindings);
  // Pass the raw JSON text rather than `res.json()` — openapi-typescript's `source` type doesn't
  // accept the `unknown` that `.json()` returns, and a `{`-prefixed string is parsed the same way.
  const spec = await res.text();

  const ast = await openapiTS(spec);
  const contents = astToString(ast);

  await mkdir("src/generated", { recursive: true });
  await writeFile("src/generated/schema.d.ts", contents);
}

await generateClient();
