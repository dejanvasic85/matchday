import { checkResolvedHost } from "#webhookHost.ts";

const resolveTo = (...addresses: string[]) => vi.fn().mockResolvedValue(addresses);

describe("checkResolvedHost", () => {
  it("accepts a host that resolves only to public addresses", async () => {
    const result = await checkResolvedHost(
      "hooks.example.com",
      resolveTo("203.0.113.5", "2606:4700::1111"),
    );

    expect(result.ok).toBe(true);
  });

  it.each([
    "10.0.0.5",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.4.1",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.5",
    "::ffff:169.254.169.254",
  ])("refuses a host that resolves to %s", async (address) => {
    const result = await checkResolvedHost("hooks.example.com", resolveTo(address));

    assert(!result.ok);
    expect(result.error.message).toContain("internal address");
  });

  it("refuses a host when only one of its addresses is internal", async () => {
    const result = await checkResolvedHost(
      "hooks.example.com",
      resolveTo("203.0.113.5", "10.0.0.5"),
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a host that does not resolve", async () => {
    const result = await checkResolvedHost(
      "hooks.example.com",
      vi.fn().mockRejectedValue(new Error("ENOTFOUND")),
    );

    assert(!result.ok);
    expect(result.error.message).toContain("did not resolve");
  });
});
