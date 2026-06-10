// The FOTW² local helper server. Loopback-only HTTP bridge so the browser
// extension (and the @fotw/pro live spine) can reach the local MCP wrenches.
//
// Safety posture:
//   - binds 127.0.0.1 ONLY (never 0.0.0.0)
//   - requires a per-run token (printed on start, set in the extension) so other
//     local pages can't poke it
//   - read-only: only relays findings + an allowlisted set of read tools; never writes
//   - holds no secrets of its own
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DEFAULT_REGISTRY, findingsFor, queryToolFor, type WrenchEntry } from "./wrenchRegistry.js";
import { callWrenchTool, callWrenchToolJson } from "./mcpClient.js";
import { mockToolResult } from "./mockTools.js";
import type { WrenchFinding, WrenchId } from "@help-me-comms/core";

export type HelperOptions = { port?: number; token?: string; registry?: WrenchEntry[] };

const STATIONS: Record<string, { label: string; color: string; tagline: string }> = {
  mod: { label: "ModWrench", color: "#4cc2ff", tagline: "Mod platforms · load order · crashlog" },
  def: { label: "DefWrench", color: "#e0964a", tagline: "Studio toolchain · builds · tickets" },
  myne: { label: "MyneWrench", color: "#2ee06a", tagline: "Creator economies · Roblox · UEFN" },
};

// Read-only tools the helper will relay to a wrench. Everything else is
// refused — the helper is a window, not a control panel. Write-shaped tools
// must never be added here; approval-gated writes belong to the wrench's own
// client, not the loopback bridge.
const RELAY_TOOLS = new Set([
  // DefWrench meta + spine
  "dw_status",
  "dw_list_products",
  "dw_detect_environment",
  "dw_correlate",
  // BuildWrench reads
  "bw_list_providers",
  "bw_list_pipelines",
  "bw_list_builds",
  "bw_get_build",
  "bw_summarize_failure",
  "bw_build_trends",
  // sibling wrench correlates (same contract)
  "mod_correlate",
  "myne_correlate",
  "correlate",
]);

export function createHelper(opts: HelperOptions = {}) {
  const port = opts.port ?? 7717;
  const token = opts.token ?? Math.random().toString(36).slice(2, 14);
  const registry = opts.registry ?? DEFAULT_REGISTRY;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS for the extension origins; loopback only.
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type, x-fotw-token");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

    // Discovery: which wrenches are available + their station chrome. No auth
    // (no sensitive data) so the extension can render the rack before pairing.
    if (req.method === "GET" && url.pathname === "/wrenches") {
      const list = registry.map((e) => ({ id: e.id, mode: e.mode, ...(STATIONS[e.id] ?? { label: e.id, color: "#9aa6c4", tagline: "" }) }));
      return json(res, 200, { ok: true, version: "0.1.0", wrenches: list });
    }

    // Findings: POST /wrench/:id  { args:{topic} }  -> { findings }
    // (the query tool is chosen server-side per wrench; clients can't pick it)
    const mFind = /^\/wrench\/([a-z]+)$/.exec(url.pathname);
    if (req.method === "POST" && mFind) {
      if ((req.headers["x-fotw-token"] as string) !== token) return json(res, 401, { ok: false, error: "bad token" });
      const id = mFind[1];
      const entry = registry.find((e) => e.id === id);
      if (!entry) return json(res, 404, { ok: false, error: "unknown wrench" });
      const body = await readBody(req);
      const topic = String(body?.args?.topic ?? body?.topic ?? "");

      let findings: WrenchFinding[] = [];
      try {
        findings = entry.mode === "mcp" && entry.command
          ? await callWrenchTool(
              { command: entry.command, args: entry.args ?? [], ...(entry.env ? { env: entry.env } : {}) },
              queryToolFor(entry),
              { topic },
              entry.id as WrenchId,
            )
          : await findingsFor(entry, topic);
      } catch {
        findings = [];
      }
      return json(res, 200, { ok: true, mode: entry.mode, findings });
    }

    // Read-only tool relay: POST /wrench/:id/tool  { tool, args }  -> { data }
    // Powers the cockpit's bays (e.g. the Build Bay reading bw_* tools).
    // Strictly allowlisted; mock-mode wrenches serve canned demo data.
    const mTool = /^\/wrench\/([a-z]+)\/tool$/.exec(url.pathname);
    if (req.method === "POST" && mTool) {
      if ((req.headers["x-fotw-token"] as string) !== token) return json(res, 401, { ok: false, error: "bad token" });
      const id = mTool[1];
      const entry = registry.find((e) => e.id === id);
      if (!entry) return json(res, 404, { ok: false, error: "unknown wrench" });
      const body = await readBody(req);
      const tool = String(body?.tool ?? "");
      const args = (body?.args && typeof body.args === "object" ? body.args : {}) as Record<string, unknown>;
      if (!RELAY_TOOLS.has(tool)) {
        return json(res, 403, { ok: false, error: `tool not relayable: ${tool || "<none>"} (read-only allowlist)` });
      }

      if (entry.mode === "mcp" && entry.command) {
        const data = await callWrenchToolJson(
          { command: entry.command, args: entry.args ?? [], ...(entry.env ? { env: entry.env } : {}) },
          tool,
          args,
        );
        if (data === null) return json(res, 502, { ok: false, error: "wrench unreachable (is it installed and on PATH?)" });
        return json(res, 200, { ok: true, mode: "mcp", data });
      }

      const demo = mockToolResult(entry.id, tool, args);
      if (demo === null) return json(res, 501, { ok: false, error: `no demo data for ${tool} on ${entry.id}` });
      return json(res, 200, { ok: true, mode: "mock", data: demo });
    }

    json(res, 404, { ok: false, error: "not found" });
  });

  return {
    listen: () => new Promise<{ port: number; token: string }>((resolve) => {
      server.listen(port, "127.0.0.1", () => {
        const addr = server.address();
        const boundPort = addr && typeof addr === "object" ? addr.port : port;
        resolve({ port: boundPort, token });
      });
    }),
    close: () => new Promise<void>((r) => server.close(() => r())),
    token,
    port,
  };
}

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
