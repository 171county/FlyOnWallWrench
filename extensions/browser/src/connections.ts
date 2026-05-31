// Tracks which sites the user has "Connected" (granted optional host permission).
// We store ONLY the granted-site list — never any credential or page content.
import { load, save } from "./store.js";
import { SITE_INFO } from "./pageReaders.js";

const KEY = "helpme.connections.v1";
let connected = new Set<string>();
const listeners = new Set<() => void>();

export async function hydrateConnections(): Promise<void> {
  // Re-derive from actual granted permissions where possible; fall back to store.
  const saved = await load<string[]>(KEY, []);
  connected = new Set(saved);
  // Verify against the live permission grants (the source of truth).
  if (typeof chrome !== "undefined" && chrome.permissions?.getAll) {
    await new Promise<void>((resolve) => {
      chrome.permissions.getAll((p) => {
        const origins = new Set(p.origins ?? []);
        for (const [src, info] of Object.entries(SITE_INFO)) {
          if (origins.has(info.origin)) connected.add(src); else connected.delete(src);
        }
        resolve();
      });
    });
    save(KEY, [...connected]);
  }
}

export function isConnected(src: string): boolean { return connected.has(src); }
export function listConnected(): string[] { return [...connected]; }

// Request the optional host permission for a site (shows Chrome's consent popup).
export async function connect(src: string): Promise<boolean> {
  const info = SITE_INFO[src];
  if (!info || typeof chrome === "undefined" || !chrome.permissions?.request) return false;
  const granted = await new Promise<boolean>((resolve) => {
    chrome.permissions.request({ origins: [info.origin] }, (ok) => resolve(!!ok));
  });
  if (granted) { connected.add(src); save(KEY, [...connected]); emit(); }
  return granted;
}

export async function disconnect(src: string): Promise<void> {
  const info = SITE_INFO[src];
  if (info && typeof chrome !== "undefined" && chrome.permissions?.remove) {
    await new Promise<void>((resolve) => chrome.permissions.remove({ origins: [info.origin] }, () => resolve()));
  }
  connected.delete(src);
  save(KEY, [...connected]);
  emit();
}

export function onConnectionsChange(fn: () => void): void { listeners.add(fn); }
function emit() { listeners.forEach((fn) => fn()); }
