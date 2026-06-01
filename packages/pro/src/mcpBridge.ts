// Real, MCP-backed wrench bridge (the live spine).
//
// The wrenches (ModWrench/DefWrench/MyneWrench) are MCP servers. A browser
// extension can't spawn stdio MCP servers directly, so a small LOCAL BRIDGE
// (the FOTW² helper) exposes each wrench over a localhost HTTP endpoint that
// proxies MCP tool calls. This adapter calls that endpoint and normalizes the
// wrench's read-only tool output into WrenchFindings the spine can thread.
//
// Holds no secrets: the local bridge owns credentials (OS keychain / the
// wrench's own config); this just asks it questions over loopback. If the
// bridge isn't running, callers fall back to the mock bridges (demo stays alive).
import type { WrenchBridge, WrenchFinding, WrenchId, WrenchStation } from "@help-me-comms/core";

export type McpBridgeConfig = {
  id: WrenchId;
  station: WrenchStation;
  endpoint: string;          // e.g. http://127.0.0.1:7717/wrench/mod
  // which MCP tool to call for a free-text "what do you know about X" query,
  // and how to read its result into findings.
  queryTool: string;         // e.g. "mod_correlate" | "dw_correlate"
  timeoutMs?: number;
};

// Shape we expect back from the local bridge (kept loose on purpose).
type BridgeResponse = {
  findings?: Array<{ kind?: string; title?: string; detail?: string; ref?: string; weight?: number }>;
};

export class McpWrenchBridge implements WrenchBridge {
  id: WrenchId;
  station: WrenchStation;
  private cfg: McpBridgeConfig;

  constructor(cfg: McpBridgeConfig) {
    this.cfg = { timeoutMs: 4000, ...cfg };
    this.id = cfg.id;
    this.station = cfg.station;
  }

  async findings(topic: string): Promise<WrenchFinding[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(this.cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: this.cfg.queryTool, args: { topic } }),
        signal: ctrl.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as BridgeResponse;
      return (data.findings ?? [])
        .filter((f) => (f.detail ?? f.title))
        .map((f) => ({
          wrench: this.id,
          kind: f.kind ?? "finding",
          title: f.title ?? "Finding",
          detail: f.detail ?? f.title ?? "",
          ref: f.ref,
          weight: clamp01(typeof f.weight === "number" ? f.weight : 0.5),
        }));
    } catch {
      return []; // unreachable bridge -> no findings; caller falls back to mock
    } finally {
      clearTimeout(timer);
    }
  }
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

// Build the live bridges from a config map (e.g. read from the local helper's
// discovery endpoint). Returns null when nothing is configured, so the cockpit
// keeps using the mock bridges.
export function liveBridgesFromConfig(configs: McpBridgeConfig[] | undefined): McpWrenchBridge[] | null {
  if (!configs || configs.length === 0) return null;
  return configs.map((c) => new McpWrenchBridge(c));
}
