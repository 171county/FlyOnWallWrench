// Connects the Rack to the FOTW² local helper (if the user has started it).
// Stores only the loopback URL + token (no secrets — the helper holds none
// either). When unset/unreachable, the Rack uses the mock bridges.
import { load, save } from "./store.js";
import type { WrenchBridge, WrenchFinding, WrenchId, WrenchStation } from "@help-me-comms/core";

const KEY = "helpme.helper.v1";
type HelperCfg = { url: string; token: string };
let cfg: HelperCfg | null = null;

export async function hydrateHelper(): Promise<void> {
  const saved = await load<HelperCfg | null>(KEY, null);
  cfg = saved && saved.url ? saved : null;
}
export function getHelper(): HelperCfg | null { return cfg; }
export function setHelper(url: string, token: string): void {
  cfg = url ? { url: url.replace(/\/+$/, ""), token } : null;
  save(KEY, cfg);
}

// A WrenchBridge backed by the local helper endpoint.
class HelperBridge implements WrenchBridge {
  constructor(public id: WrenchId, public station: WrenchStation, private base: string, private token: string) {}
  async findings(topic: string): Promise<WrenchFinding[]> {
    try {
      const res = await fetch(`${this.base}/wrench/${this.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-fotw-token": this.token },
        body: JSON.stringify({ tool: "correlate", args: { topic } }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.findings ?? []).map((f: WrenchFinding) => ({ ...f, wrench: this.id }));
    } catch { return []; }
  }
}

// Probe the helper's discovery endpoint; build live bridges for what it reports.
// Returns null when no helper is configured/reachable -> caller uses mocks.
export async function liveHelperBridges(stationFor: (id: string) => WrenchStation): Promise<WrenchBridge[] | null> {
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/wrenches`);
    if (!res.ok) return null;
    const data = await res.json();
    const list = (data.wrenches ?? []) as Array<{ id: string }>;
    if (!list.length) return null;
    return list.map((w) => new HelperBridge(w.id as WrenchId, stationFor(w.id), cfg!.url, cfg!.token));
  } catch { return null; }
}
