import { clientSchema } from "#entities/client.ts";

function makeValidClient() {
  return {
    id: "cli_abc123",
    name: "Williamstown SC",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("clientSchema", () => {
  it("accepts a valid client", () => {
    const result = clientSchema.safeParse(makeValidClient());

    expect(result.success).toBe(true);
  });

  it("rejects a client missing a name", () => {
    const { name: _name, ...withoutName } = makeValidClient();

    const result = clientSchema.safeParse(withoutName);

    expect(result.success).toBe(false);
  });
});
