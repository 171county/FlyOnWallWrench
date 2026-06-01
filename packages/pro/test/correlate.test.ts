import { describe, expect, it } from "vitest";
import { correlate } from "../src/correlate.js";
import type { WrenchBridge, WrenchFinding } from "@help-me-comms/core";

function bridge(id: any, findings: WrenchFinding[]): WrenchBridge {
  return { id, station: { id, label: id, tagline: "", color: "#fff", available: true }, findings: async () => findings };
}

describe("correlate (cross-wrench spine)", () => {
  it("threads findings in narrative order: signal -> cause -> fix -> economy", async () => {
    const bridges = [
      bridge("def", [{ wrench: "def", kind: "ticket", title: "T", detail: "ticket GAME-1", weight: 0.8 }]),
      bridge("mod", [{ wrench: "mod", kind: "load", title: "M", detail: "suspect mod", weight: 0.85 }]),
      bridge("fotw", [{ wrench: "fotw", kind: "signal", title: "S", detail: "widely reported", weight: 0.9 }]),
    ];
    const t = await correlate("boss crash", bridges);
    // fotw (signal) must lead, then mod (cause), then def (fix)
    expect(t.findings.map((f) => f.wrench)).toEqual(["fotw", "mod", "def"]);
    expect(t.contributors).toEqual(["fotw", "mod", "def"]);
    expect(t.story).toMatch(/Community:.*→.*Likely cause:.*→.*On the dev side:/s);
    expect(t.confidence).toBeGreaterThan(0);
  });

  it("returns a graceful empty thread when no wrench has findings", async () => {
    const t = await correlate("nothing", [bridge("mod", [])]);
    expect(t.findings).toHaveLength(0);
    expect(t.confidence).toBe(0);
    expect(t.story).toMatch(/No connected wrench findings/);
  });

  it("more contributing wrenches raises confidence", async () => {
    const one = await correlate("x", [bridge("mod", [{ wrench: "mod", kind: "k", title: "t", detail: "d", weight: 0.8 }])]);
    const three = await correlate("x", [
      bridge("fotw", [{ wrench: "fotw", kind: "k", title: "t", detail: "d", weight: 0.8 }]),
      bridge("mod", [{ wrench: "mod", kind: "k", title: "t", detail: "d", weight: 0.8 }]),
      bridge("def", [{ wrench: "def", kind: "k", title: "t", detail: "d", weight: 0.8 }]),
    ]);
    expect(three.confidence).toBeGreaterThan(one.confidence);
  });
});
