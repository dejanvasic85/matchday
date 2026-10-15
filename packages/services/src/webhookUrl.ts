// Webhook URL rule: a client chooses where our crawl runner sends requests, so only a public
// https hostname is allowed. Checked when a URL is saved and again before each delivery.

import { badRequest, ok, type Result } from "@matchday/domain";

const requiredProtocol = "https:";
const localhostName = "localhost";
const ipv4Pattern = /^\d{1,3}(\.\d{1,3}){3}$/;

/** True for an IP address host. The URL parser rewrites every IPv4 form (`0x7f.1`, `2130706433`)
 * to dotted decimal, and wraps IPv6 in brackets. */
function isIpAddress(hostname: string): boolean {
  return ipv4Pattern.test(hostname) || hostname.startsWith("[");
}

/** True for a name that can only resolve inside a network: `localhost`, `*.localhost`, or a
 * single label such as `intranet`, which resolves through the runner's search domain. */
function isInternalName(hostname: string): boolean {
  return (
    hostname === localhostName || hostname.endsWith(`.${localhostName}`) || !hostname.includes(".")
  );
}

/** Accept a URL only when it is https and names a public hostname. Every IP address is refused,
 * not just private ones, so no address range can slip through a missed case. */
export function validateWebhookUrl(value: string): Result<string> {
  const refused = badRequest(`Webhook URL must be https with a public hostname: ${value}`);

  const url = URL.parse(value);
  if (url === null) {
    return refused;
  }

  // Credentials would be stored and then logged with the URL; the message leaves the value out.
  if (url.username !== "" || url.password !== "") {
    return badRequest("Webhook URL must not contain a username or password");
  }

  const hostname = url.hostname.replace(/\.$/, "");
  if (url.protocol !== requiredProtocol || isIpAddress(hostname) || isInternalName(hostname)) {
    return refused;
  }
  return ok(value);
}
