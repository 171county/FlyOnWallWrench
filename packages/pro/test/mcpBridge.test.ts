import { afterEach, describe, expect, it, vi } from "vitest";
import { McpWrenchBridge, liveBridgesFromConfig } from "../src/mcpBridge.js";

const station = { id: "mod" as const, label: "ModWrench", tagline: "", color: "#4cc2ff", available: true };
const cfg = { id: "mod" as const, station, endpoint: "http://127.0.0.1:7717/wrench/mod", queryTool: "mod_correlate" };

afterEach(() => vi.restoreAllMocks());

describe("McpWrenchBridge (live spine)", () => {
  it("normalizes the local bridge's tool output into findings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
      findings: [{ kind: "load_order_hit", title: "Suspect mod", detail: "HD Texture Pack flagged", ref: "HD Texture Pack", weight: 0.9 }],
    }) } as Response)));
    const b = new McpWrenchBridge(cfg);
    const f = await b.findings("boss crash");
    expect(f).toHaveLength(1);
    expect(f[0].wrench).toBe("mod");
    expect(f[0].ref).toBe("HD Texture Pack");
    expect(f[0].weight).toBe(0.9);
  });

  it("clamps weird weights and drops empty findings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({
      findings: [{ title: "ok", weight: 5 }, { weight: 0.3 }],
    }) } as Response)));
    const f = await new McpWrenchBridge(cfg).findings("x");
    expect(f).toHaveLength(1);          // the empty one (no title/detail) is dropped
    expect(f[0].weight).toBe(1);        // 5 clamped to 1
  });

  it("returns no findings (not throw) when the bridge is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const f = await new McpWrenchBridge(cfg).findings("x");
    expect(f).toEqual([]);
  });

  it("liveBridgesFromConfig returns null when nothing configured (-> mock fallback)", () => {
    expect(liveBridgesFromConfig(undefined)).toBeNull();
    expect(liveBridgesFromConfig([])).toBeNull();
    expect(liveBridgesFromConfig([cfg])).toHaveLength(1);
  });
});
