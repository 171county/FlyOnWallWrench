// What wrenches the helper knows how to reach. Each entry maps a wrench id to
// how the helper produces findings for it. Two modes:
//   - "mock": built-in demo findings (works with zero setup)
//   - "mcp":  spawn/relay the real wrench MCP server (config provided by the user)
// The helper holds NO secrets itself — real wrench creds live in the wrench's own
// config / the OS keychain, exactly as each wrench already does.
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
};

const mocks = createMockWrenchBridges();
const mockById = new Map(mocks.map((m) => [m.id as string, m]));

// Default config: everything mock until the user configures real MCP wrenches.
export const DEFAULT_REGISTRY: WrenchEntry[] = [
  { id: "mod", mode: "mock" },
  { id: "def", mode: "mock" },
  { id: "myne", mode: "mock" },
];

export async function findingsFor(entry: WrenchEntry, topic: string): Promise<WrenchFinding[]> {
  if (entry.mode === "mock") {
    const bridge = mockById.get(entry.id);
    return bridge ? bridge.findings(topic) : [];
  }
  // mcp mode is wired in mcpClient.ts; the server calls that path.
  return [];
}
