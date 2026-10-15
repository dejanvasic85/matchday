import { badRequest, ok } from "@matchday/domain";
import { validateWebhookUrl } from "#webhookUrl.ts";

describe("validateWebhookUrl", () => {
  it("accepts an https URL on a public hostname", () => {
    const url = "https://www.williamstownsc.com/api/revalidate";

    expect(validateWebhookUrl(url)).toEqual(ok(url));
  });

  it("accepts a public hostname on a custom port", () => {
    const url = "https://hooks.example.com:8443/matchday";

    expect(validateWebhookUrl(url)).toEqual(ok(url));
  });

  it("refuses plain http", () => {
    const url = "http://example.com/hook";

    expect(validateWebhookUrl(url)).toEqual(
      badRequest(`Webhook URL must be https with a public hostname: ${url}`),
    );
  });

  it("refuses text that is not a URL", () => {
    expect(validateWebhookUrl("not a url").ok).toBe(false);
  });

  it.each([
    "https://localhost/hook",
    "https://LOCALHOST/hook",
    "https://localhost./hook",
    "https://api.localhost/hook",
    "https://intranet/hook",
  ])("refuses the internal name in %s", (url) => {
    expect(validateWebhookUrl(url).ok).toBe(false);
  });

  it.each([
    "https://127.0.0.1/hook",
    "https://10.0.0.5/hook",
    "https://169.254.169.254/latest",
    "https://8.8.8.8/hook",
    "https://2130706433/hook",
    "https://0x7f.1/hook",
    "https://[::1]/hook",
    "https://[::ffff:127.0.0.1]/hook",
    "https://[2606:4700::1111]/hook",
  ])("refuses the IP address host in %s", (url) => {
    expect(validateWebhookUrl(url).ok).toBe(false);
  });
});
