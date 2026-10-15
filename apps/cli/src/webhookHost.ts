// Delivery-time host check: a public-looking name can still resolve to an internal address,
// so every address it resolves to must be public before we send.

import { lookup } from "node:dns/promises";
import { BlockList } from "node:net";
import { badRequest, ok, type Result } from "@matchday/domain";

const internalRangesValue: ReadonlyArray<readonly [string, number, "ipv4" | "ipv6"]> = [
  ["0.0.0.0", 8, "ipv4"],
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"],
  ["224.0.0.0", 3, "ipv4"],
  ["::", 128, "ipv6"],
  ["::1", 128, "ipv6"],
  ["fc00::", 7, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["fec0::", 10, "ipv6"],
  ["ff00::", 8, "ipv6"],
];

const internalRanges = new BlockList();
for (const [network, prefix, family] of internalRangesValue) {
  internalRanges.addSubnet(network, prefix, family);
}

export type ResolveAddresses = (hostname: string) => Promise<string[]>;

const resolveWithDns: ResolveAddresses = async (hostname) =>
  (await lookup(hostname, { all: true })).map(({ address }) => address);

function isInternalAddress(address: string): boolean {
  return internalRanges.check(address, address.includes(":") ? "ipv6" : "ipv4");
}

/** Refuse a hostname when any address it resolves to is internal. */
export async function checkResolvedHost(
  hostname: string,
  resolve: ResolveAddresses = resolveWithDns,
): Promise<Result<void>> {
  const addresses = await resolve(hostname).catch(() => []);
  if (addresses.length === 0) {
    return badRequest(`Webhook host ${hostname} did not resolve`);
  }
  if (addresses.some(isInternalAddress)) {
    return badRequest(`Webhook host ${hostname} resolves to an internal address`);
  }
  return ok(undefined);
}
