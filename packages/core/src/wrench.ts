// The Wrench Bridge contract — how FOTW² (the cockpit) talks to the other
// wrenches (ModWrench, DefWrench, MyneWrench). Each wrench is an MCP server in
// its own repo; a small local bridge exposes a read-only slice to the cockpit.
// Here we define the SHARED shapes so the correlation spine can thread a single
// story across them. Bridges are pluggable: mock now, real MCP bridges later.

export type WrenchId = "mod" | "def" | "myne" | "fotw";

export type WrenchStation = {
  id: WrenchId;
  label: string;          // "ModWrench"
  tagline: string;        // one-liner for the rack
  color: string;          // accent on the pegboard
  available: boolean;     // is a bridge reachable / paired
};

// --- per-wrench read-only context the cockpit can show + correlate ----------

// ModWrench: what's installed and what broke (load order, crashlog, mod meta)
export type ModContext = {
  loadOrder: Array<{ name: string; enabled: boolean; version?: string; updatedRecently?: boolean }>;
  crashlog?: { lastFrame?: string; topFrame?: string; suspectMod?: string };
  installed: Array<{ name: string; platform: string; version?: string }>;
};

// DefWrench: the studio toolchain (CI build, tickets, recent commits to an asset)
export type DevContext = {
  build?: { system: string; status: "passing" | "failing" | "running"; lastRun?: string };
  tickets: Array<{ id: string; title: string; status: string; touchesAsset?: string }>;
  recentCommits: Array<{ sha: string; message: string; asset?: string }>;
};

// MyneWrench: creator-economy signals (different shape on purpose)
export type CreatorContext = {
  experiences: Array<{ name: string; mau?: number; revenueTrend?: "up" | "flat" | "down" }>;
  payouts?: { period: string; amount?: number };
};

// A normalized "finding" any wrench can contribute to a thread.
export type WrenchFinding = {
  wrench: WrenchId;
  kind: string;                 // "load_order_hit" | "open_ticket" | "build_failing" ...
  title: string;
  detail: string;
  ref?: string;                 // e.g. mod name, ticket id, sha
  weight: number;               // 0..1 — how strongly it supports the thread
};

// The bridge each wrench implements. Read-only; bodies are ephemeral.
export interface WrenchBridge {
  id: WrenchId;
  station: WrenchStation;
  // Given a community signal/topic, return findings this wrench can offer.
  findings(topic: string): Promise<WrenchFinding[]>;
}
