// The FOTW² local helper server. Loopback-only HTTP bridge so the browser
// extension (and the @fotw/pro live spine) can reach the local MCP wrenches.
//
// Safety posture:
//   - binds 127.0.0.1 ONLY (never 0.0.0.0)
//   - requires a per-run token (printed on start, set in the extension) so other
//     local pages can't poke it
//   - read-only: only relays "findings"-style read tools; never writes
//   - holds no secrets of its own
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DEFAULT_REGISTRY, findingsFor, type WrenchEntry } from "./wrenchRegistry.js";
import { callWrenchTool } from "./mcpClient.js";
import type { WrenchFinding } from "@help-me-comms/core";

export type HelperOptions = { port?: number; token?: string; registry?: WrenchEntry[] };

const STATIONS: Record<string, { label: string; color: string; tagline: string }> = {
  mod: { label: "ModWrench", color: "#4cc2ff", tagline: "Mod platforms · load order · crashlog" },
  def: { label: "DefWrench", color: "#e0964a", tagline: "Studio toolchain · builds · tickets" },
  myne: { label: "MyneWrench", color: "#2ee06a", tagline: "Creator economies · Roblox · UEFN" },
};

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

    // Findings: POST /wrench/:id  { tool, args:{topic} }  -> { findings }
    const m = /^\/wrench\/([a-z]+)$/.exec(url.pathname);
    if (req.method === "POST" && m) {
      if ((req.headers["x-fotw-token"] as string) !== token) return json(res, 401, { ok: false, error: "bad token" });
      const id = m[1];
      const entry = registry.find((e) => e.id === id);
      if (!entry) return json(res, 404, { ok: false, error: "unknown wrench" });
      const body = await readBody(req);
      const topic = String(body?.args?.topic ?? body?.topic ?? "");

      let findings: WrenchFinding[] = [];
      try {
        findings = entry.mode === "mcp" && entry.command
          ? await callWrenchTool(entry.command, entry.args ?? [], entry.queryTool ?? "correlate", { topic })
          : await findingsFor(entry, topic);
      } catch {
        findings = [];
      }
      return json(res, 200, { ok: true, findings });
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
