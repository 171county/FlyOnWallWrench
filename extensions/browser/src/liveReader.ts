// Reads the live community feed from the user's CURRENT tab using their own
// logged-in session — by injecting a DOM scraper. No tokens, nothing stored.
import { pageScrapeFn, SITE_INFO, type ScrapedMsg } from "./pageReaders.js";

export type LiveResult =
  | { ok: true; site: string; url: string; messages: ScrapedMsg[] }
  | { ok: false; reason: "no_tab" | "not_on_site" | "no_permission" | "blocked"; site?: string };

// Which connected site (if any) the active tab currently is.
function siteForUrl(url: string): string | undefined {
  let host = "";
  try { host = new URL(url).host; } catch { return undefined; }
  for (const [src, info] of Object.entries(SITE_INFO)) if (info.match.test(host)) return src;
  return undefined;
}

export async function readActiveTab(): Promise<LiveResult> {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return { ok: false, reason: "no_tab" };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { ok: false, reason: "no_tab" };

  const site = siteForUrl(tab.url);
  if (!site) return { ok: false, reason: "not_on_site" };

  const info = SITE_INFO[site];
  const hasPerm = await new Promise<boolean>((resolve) =>
    chrome.permissions.contains({ origins: [info.origin] }, (ok) => resolve(!!ok)),
  );
  if (!hasPerm) return { ok: false, reason: "no_permission", site };

  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageScrapeFn,
      args: [info.scrapeKey],
    });
    const messages = (res?.result as ScrapedMsg[]) ?? [];
    return { ok: true, site, url: tab.url, messages };
  } catch {
    return { ok: false, reason: "blocked", site };
  }
}
