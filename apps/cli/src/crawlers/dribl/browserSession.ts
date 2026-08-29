// Launches Chrome, visits the Dribl site once for Cloudflare clearance, hands back the page.
// Endpoint is abstracted: connect over BROWSER_WS_ENDPOINT when set, else launch local.

import { ok, serverError, type Result } from "@matchday/domain";
import { type Browser, chromium, type Page } from "playwright-core";
import { crawlerConfigValue } from "#crawlers/dribl/constants.ts";

export type BrowserSession = {
  page: Page;
  close: () => Promise<void>;
};

export type OpenBrowserSessionOptions = {
  driblSiteUrl: string;
  browserWsEndpoint?: string;
  headless?: boolean;
};

async function launchBrowser(options: OpenBrowserSessionOptions): Promise<Browser> {
  if (options.browserWsEndpoint !== undefined) {
    return chromium.connect(options.browserWsEndpoint);
  }
  return chromium.launch({ headless: options.headless ?? true, channel: "chrome" });
}

export async function openBrowserSession(
  options: OpenBrowserSessionOptions,
): Promise<Result<BrowserSession>> {
  let browser: Browser;
  try {
    browser = await launchBrowser(options);
  } catch (cause) {
    return serverError("Failed to launch browser", cause);
  }

  try {
    const context = await browser.newContext({
      userAgent: crawlerConfigValue.userAgent,
      viewport: crawlerConfigValue.viewport,
    });
    const page = await context.newPage();

    await page.goto(options.driblSiteUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(crawlerConfigValue.clearanceWaitMs);

    return ok({
      page,
      close: () => browser.close(),
    });
  } catch (cause) {
    await browser.close();
    return serverError("Failed to establish Cloudflare clearance", cause);
  }
}
