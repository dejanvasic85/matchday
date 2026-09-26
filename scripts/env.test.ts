import { replaceDatabaseUrl, replaceEnvValue } from "#scripts/env.ts";

describe("replaceDatabaseUrl", () => {
  const env = "DATABASE_URL=postgres://old\nLOG_LEVEL=info\n";

  it("rewrites the one key and leaves every other value alone", () => {
    expect(replaceDatabaseUrl(env, "postgres://new")).toBe(
      "DATABASE_URL=postgres://new\nLOG_LEVEL=info\n",
    );
  });

  it("appends the key when the file does not carry it yet", () => {
    expect(replaceDatabaseUrl("LOG_LEVEL=info\n", "postgres://new")).toBe(
      "LOG_LEVEL=info\nDATABASE_URL=postgres://new\n",
    );
  });

  // A key elsewhere in the file must not be mistaken for the one being set.
  it("rewrites the line that starts with the key, not one that contains it", () => {
    const contents = "OTHER_DATABASE_URL=postgres://other\nDATABASE_URL=postgres://old\n";

    expect(replaceDatabaseUrl(contents, "postgres://new")).toBe(
      "OTHER_DATABASE_URL=postgres://other\nDATABASE_URL=postgres://new\n",
    );
  });

  it("rewrites only the first line, since .env holds one of each key", () => {
    const contents = "DATABASE_URL=postgres://a\nDATABASE_URL=postgres://b\n";

    expect(replaceDatabaseUrl(contents, "postgres://new")).toBe(
      "DATABASE_URL=postgres://new\nDATABASE_URL=postgres://b\n",
    );
  });
});

describe("replaceEnvValue", () => {
  it("clears a key to an empty value", () => {
    const contents = "LOG_LEVEL=info\nOTHER=kept\n";

    expect(replaceEnvValue(contents, "LOG_LEVEL", "")).toBe("LOG_LEVEL=\nOTHER=kept\n");
  });

  it("appends the key when the file does not carry it yet", () => {
    expect(replaceEnvValue("OTHER=kept\n", "LOG_LEVEL", "debug")).toBe(
      "OTHER=kept\nLOG_LEVEL=debug\n",
    );
  });
});
