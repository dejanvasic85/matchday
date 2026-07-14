// Launches a real Chrome browser (local, or connected to a managed endpoint per 0009), visits
// the Dribl site once to obtain Cloudflare clearance, and hands back the page for subsequent
// API calls via browserFetch. Browser endpoint is abstracted so thanos <-> managed is a config
// change (0009): connect over BROWSER_WS_ENDPOINT when set, else launch local Chrome.

import { err, ok, type Result } from "@matchday/domain";
import { type Browser, chromium, type Page } from "playwright-core";
import { crawlerConfigValue } from "./constants.ts";

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
    return err({ message: "Failed to launch browser", cause });
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
    return err({ message: "Failed to establish Cloudflare clearance", cause });
  }
}
