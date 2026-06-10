// What wrenches the helper knows how to reach. Each entry maps a wrench id to
// how the helper produces findings for it. Two modes:
//   - "mock": built-in demo findings (works with zero setup)
//   - "mcp":  spawn/relay the real wrench MCP server (config provided by the user)
// The helper holds NO secrets itself — real wrench creds live in the wrench's own
// config / the OS keychain, exactly as each wrench already does.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMockWrenchBridges } from "@help-me-comms/adapters";
import type { WrenchFinding } from "@help-me-comms/core";

export type WrenchMode = "mock" | "mcp";
export type WrenchEntry = {
  id: string;
  mode: WrenchMode;
  // for mcp mode: how to launch the wrench MCP server + which tool to call
  command?: string;
  args?: string[];
  queryTool?: string;
  /** env vars to pass to the spawned wrench (merged over the helper's env). */
  env?: Record<string, string>;
};

const mocks = createMockWrenchBridges();
const mockById = new Map(mocks.map((m) => [m.id as string, m]));

// Default config: everything mock until the user configures real MCP wrenches.
export const DEFAULT_REGISTRY: WrenchEntry[] = [
  { id: "mod", mode: "mock" },
  { id: "def", mode: "mock" },
  { id: "myne", mode: "mock" },
];

/** The free-text query tool each wrench exposes for the correlation spine. */
export const DEFAULT_QUERY_TOOL: Record<string, string> = {
  mod: "mod_correlate",
  def: "dw_correlate",
  myne: "myne_correlate",
};

export function queryToolFor(entry: WrenchEntry): string {
  return entry.queryTool ?? DEFAULT_QUERY_TOOL[entry.id] ?? "correlate";
}

/**
 * Load the wrench registry from the user's config, merged over the defaults so
 * configuring one real wrench keeps the others in demo mode. Config locations,
 * in order: $FOTW_HELPER_WRENCHES (a JSON path), then ~/.fotw/wrenches.json.
 *
 * Config shape (see configs/examples/helper.wrenches.json):
 *   { "wrenches": [ { "id": "def", "mode": "mcp",
 *       "command": "defwrench", "args": [], "queryTool": "dw_correlate" } ] }
 */
export function loadRegistry(
  env: NodeJS.ProcessEnv = process.env
): { registry: WrenchEntry[]; configPath?: string; configError?: string } {
  const candidates = [
    env.FOTW_HELPER_WRENCHES,
    join(homedir(), ".fotw", "wrenches.json"),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as {
        wrenches?: unknown;
      };
      const list = Array.isArray(raw.wrenches) ? raw.wrenches : [];
      const byId = new Map(DEFAULT_REGISTRY.map((e) => [e.id, { ...e }]));
      for (const item of list) {
        const e = item as Partial<WrenchEntry>;
        if (typeof e.id !== "string" || !e.id) continue;
        if (e.mode === "mcp" && typeof e.command !== "string") continue;
        byId.set(e.id, {
          id: e.id,
          mode: e.mode === "mcp" ? "mcp" : "mock",
          ...(typeof e.command === "string" ? { command: e.command } : {}),
          ...(Array.isArray(e.args) ? { args: e.args.map(String) } : {}),
          ...(typeof e.queryTool === "string" ? { queryTool: e.queryTool } : {}),
          ...(e.env && typeof e.env === "object" ? { env: e.env as Record<string, string> } : {}),
        });
      }
      return { registry: [...byId.values()], configPath: path };
    } catch (err) {
      return {
        registry: DEFAULT_REGISTRY,
        configPath: path,
        configError: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return { registry: DEFAULT_REGISTRY };
}

export async function findingsFor(entry: WrenchEntry, topic: string): Promise<WrenchFinding[]> {
  if (entry.mode === "mock") {
    const bridge = mockById.get(entry.id);
    return bridge ? bridge.findings(topic) : [];
  }
  // mcp mode is wired in mcpClient.ts; the server calls that path.
  return [];
}
