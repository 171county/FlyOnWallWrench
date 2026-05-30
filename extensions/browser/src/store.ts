// Tiny persistence layer over chrome.storage.local with an in-memory fallback
// (so the same code runs in tests / non-extension contexts). Only NON-sensitive
// UI state is persisted: the approval queue (drafts the user made), target
// selections, last active tab, and custom-source definitions. No tokens, no
// fetched community message bodies beyond what the user themself drafted.

type Bag = Record<string, unknown>;
const mem: Bag = {};

const hasChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;

export async function load<T>(key: string, fallback: T): Promise<T> {
  if (!hasChrome) return (key in mem ? (mem[key] as T) : fallback);
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve((res?.[key] as T) ?? fallback));
  });
}

export function save(key: string, value: unknown): void {
  if (!hasChrome) { mem[key] = value; return; }
  chrome.storage.local.set({ [key]: value });
}
