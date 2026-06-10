// Minimal MCP stdio client: spawn a wrench's MCP server, call ONE read-only
// tool, return its result. Dependency-free JSON-RPC over stdio (the MCP
// transport). Used only in "mcp" mode; failures degrade to empty results so the
// cockpit falls back to mock. This is the piece that, given a real wrench
// command, makes the live spine actually reach ModWrench/DefWrench/MyneWrench.
import { spawn } from "node:child_process";
import type { WrenchFinding, WrenchId } from "@help-me-comms/core";

type Json = Record<string, unknown>;

export type SpawnSpec = {
  command: string;
  args: string[];
  /** extra env for the wrench process (merged over the helper's env). */
  env?: Record<string, string>;
};

/**
 * Spawn the wrench server, run the MCP handshake, call one tool, and resolve
 * with the raw JSON-RPC result (or null on any failure/timeout). One process
 * per call: wrenches boot in well under a second and this keeps the helper
 * stateless and crash-proof.
 */
export function callToolRaw(
  spec: SpawnSpec,
  tool: string,
  toolArgs: Json,
  timeoutMs = 12_000,
): Promise<Json | null> {
  return new Promise((resolve) => {
    let done = false;
    let child: ReturnType<typeof spawn>;
    const finish = (r: Json | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child.kill(); } catch { /* already gone */ }
      resolve(r);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    try {
      child = spawn(spec.command, spec.args, {
        stdio: ["pipe", "pipe", "ignore"],
        env: { ...process.env, ...(spec.env ?? {}) },
      });
    } catch {
      clearTimeout(timer);
      return resolve(null);
    }

    let buf = "";
    let nextId = 1;
    const send = (msg: Json) => {
      try { child.stdin!.write(JSON.stringify(msg) + "\n"); } catch { finish(null); }
    };

    child.stdout!.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: Json;
        try { msg = JSON.parse(line); } catch { continue; }
        handle(msg);
      }
    });
    child.on("error", () => finish(null));
    child.on("exit", () => finish(null));

    // 1) initialize  2) tools/call  3) resolve
    send({ jsonrpc: "2.0", id: nextId++, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "fotw-helper", version: "0.1.0" } } });

    function handle(msg: Json) {
      const id = msg.id as number | undefined;
      if (id === 1) {
        // initialized -> announce + call the tool
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: tool, arguments: toolArgs } });
      } else if (id === 2) {
        finish(msg);
      }
    }
  });
}

/**
 * Call a wrench's tool and parse the first text content block as JSON.
 * Returns null when the wrench is unreachable or returned nothing usable.
 */
export async function callWrenchToolJson(
  spec: SpawnSpec,
  tool: string,
  toolArgs: Json,
  timeoutMs?: number,
): Promise<unknown | null> {
  const msg = await callToolRaw(spec, tool, toolArgs, timeoutMs);
  const text = firstText(msg);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { text }; }
}

/** Call a wrench's correlate-style tool and normalize to WrenchFindings. */
export async function callWrenchTool(
  spec: SpawnSpec,
  tool: string,
  toolArgs: Json,
  wrenchId: WrenchId = "def",
  timeoutMs = 8000,
): Promise<WrenchFinding[]> {
  const msg = await callToolRaw(spec, tool, toolArgs, timeoutMs);
  if (!msg) return [];
  return parseToolResult(msg, wrenchId);
}

function firstText(msg: Json | null): string {
  if (!msg) return "";
  const result = msg.result as Json | undefined;
  const content = (result?.content as Array<Json>) ?? [];
  const textBlock = content.find((c) => c.type === "text");
  return (textBlock?.text as string) ?? "";
}

// Wrench tools return MCP content blocks; we accept either a JSON findings array
// in a text block, or fall back to a single text finding.
function parseToolResult(msg: Json, wrenchId: WrenchId): WrenchFinding[] {
  const text = firstText(msg);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.findings)) return parsed.findings as WrenchFinding[];
    if (Array.isArray(parsed)) return parsed as WrenchFinding[];
  } catch {
    // not JSON — wrap the text as a single low-weight finding
    return [{ wrench: wrenchId, kind: "text", title: "Wrench result", detail: text.slice(0, 280), weight: 0.4 } as WrenchFinding];
  }
  return [];
}
