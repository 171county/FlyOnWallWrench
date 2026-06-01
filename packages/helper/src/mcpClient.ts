// Minimal MCP stdio client: spawn a wrench's MCP server, call ONE read-only
// tool, return its text result. Dependency-free JSON-RPC over stdio (the MCP
// transport). Used only in "mcp" mode; failures degrade to no findings so the
// cockpit falls back to mock. This is the piece that, given a real wrench
// command, makes the live spine actually reach ModWrench/DefWrench/MyneWrench.
import { spawn } from "node:child_process";
import type { WrenchFinding } from "@help-me-comms/core";

type Json = Record<string, unknown>;

export async function callWrenchTool(
  command: string,
  args: string[],
  tool: string,
  toolArgs: Json,
  timeoutMs = 8000,
): Promise<WrenchFinding[]> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (f: WrenchFinding[]) => { if (!done) { done = true; try { child.kill(); } catch {} resolve(f); } };
    const timer = setTimeout(() => finish([]), timeoutMs);

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: ["pipe", "pipe", "ignore"] });
    } catch {
      clearTimeout(timer); return resolve([]);
    }

    let buf = "";
    let nextId = 1;
    const send = (msg: Json) => child.stdin!.write(JSON.stringify(msg) + "\n");

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
    child.on("error", () => { clearTimeout(timer); finish([]); });
    child.on("exit", () => { clearTimeout(timer); finish([]); });

    // 1) initialize  2) tools/call  3) parse
    send({ jsonrpc: "2.0", id: nextId++, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "fotw-helper", version: "0.1.0" } } });

    function handle(msg: Json) {
      const id = msg.id as number | undefined;
      if (id === 1) {
        // initialized -> announce + call the tool
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name: tool, arguments: toolArgs } });
      } else if (id === 2) {
        clearTimeout(timer);
        finish(parseToolResult(msg));
      }
    }
  });
}

// Wrench tools return MCP content blocks; we accept either a JSON findings array
// in a text block, or fall back to a single text finding.
function parseToolResult(msg: Json): WrenchFinding[] {
  const result = msg.result as Json | undefined;
  const content = (result?.content as Array<Json>) ?? [];
  const textBlock = content.find((c) => c.type === "text");
  const text = (textBlock?.text as string) ?? "";
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.findings)) return parsed.findings as WrenchFinding[];
    if (Array.isArray(parsed)) return parsed as WrenchFinding[];
  } catch {
    // not JSON — wrap the text as a single low-weight finding
    return [{ wrench: "mod", kind: "text", title: "Wrench result", detail: text.slice(0, 280), weight: 0.4 } as WrenchFinding];
  }
  return [];
}
