import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHelper } from "../src/server.js";
import { loadRegistry, queryToolFor } from "../src/wrenchRegistry.js";

let helper: ReturnType<typeof createHelper>;
let base: string;
let token: string;

beforeAll(async () => {
  helper = createHelper({ port: 0 as unknown as number }); // ephemeral port
  const info = await helper.listen();
  base = `http://127.0.0.1:${info.port}`;
  token = info.token;
});
afterAll(async () => { await helper.close(); });

describe("FOTW² helper (loopback bridge)", () => {
  it("discovery lists the mock wrenches with station chrome", async () => {
    const res = await fetch(`${base}/wrenches`);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.wrenches.map((w: any) => w.id).sort()).toEqual(["def", "mod", "myne"]);
    expect(data.wrenches.find((w: any) => w.id === "mod").label).toBe("ModWrench");
  });

  it("serves findings for a topic (mock mode) with a valid token", async () => {
    const res = await fetch(`${base}/wrench/mod`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fotw-token": token },
      body: JSON.stringify({ tool: "correlate", args: { topic: "crashing at the boss" } }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.findings.length).toBeGreaterThan(0);
    expect(data.findings[0].wrench).toBe("mod");
  });

  it("rejects findings calls without the token", async () => {
    const res = await fetch(`${base}/wrench/mod`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ args: { topic: "x" } }),
    });
    expect(res.status).toBe(401);
  });

  it("404s an unknown wrench", async () => {
    const res = await fetch(`${base}/wrench/nope`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fotw-token": token },
      body: JSON.stringify({ args: { topic: "x" } }),
    });
    expect(res.status).toBe(404);
  });

  it("relays an allowlisted read tool with demo data in mock mode", async () => {
    const res = await fetch(`${base}/wrench/def/tool`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fotw-token": token },
      body: JSON.stringify({ tool: "bw_list_builds", args: { pipeline: "ci.yml" } }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("mock");
    expect(data.data.builds.length).toBeGreaterThan(0);
    expect(data.data.builds[0]).toHaveProperty("status");
  });

  it("refuses tools outside the read-only allowlist", async () => {
    const res = await fetch(`${base}/wrench/def/tool`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fotw-token": token },
      body: JSON.stringify({ tool: "bw_trigger_build", args: {} }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects tool relay without the token", async () => {
    const res = await fetch(`${base}/wrench/def/tool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "bw_list_builds", args: {} }),
    });
    expect(res.status).toBe(401);
  });
});

describe("wrench registry config", () => {
  it("merges a user config over the defaults and validates entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "fotw-helper-"));
    const path = join(dir, "wrenches.json");
    writeFileSync(path, JSON.stringify({
      wrenches: [
        { id: "def", mode: "mcp", command: "defwrench", queryTool: "dw_correlate" },
        { id: "bad", mode: "mcp" }, // no command -> dropped
      ],
    }));
    try {
      const { registry, configPath, configError } = loadRegistry({ FOTW_HELPER_WRENCHES: path } as NodeJS.ProcessEnv);
      expect(configError).toBeUndefined();
      expect(configPath).toBe(path);
      const def = registry.find((e) => e.id === "def")!;
      expect(def.mode).toBe("mcp");
      expect(def.command).toBe("defwrench");
      // mod/myne keep their mock defaults; the invalid entry is dropped
      expect(registry.find((e) => e.id === "mod")!.mode).toBe("mock");
      expect(registry.find((e) => e.id === "bad")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to all-mock defaults on a corrupt config", () => {
    const dir = mkdtempSync(join(tmpdir(), "fotw-helper-"));
    const path = join(dir, "wrenches.json");
    writeFileSync(path, "{not json");
    try {
      const { registry, configError } = loadRegistry({ FOTW_HELPER_WRENCHES: path } as NodeJS.ProcessEnv);
      expect(configError).toBeTruthy();
      expect(registry.every((e) => e.mode === "mock")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("defaults each wrench to its own correlate tool", () => {
    expect(queryToolFor({ id: "def", mode: "mcp", command: "x" })).toBe("dw_correlate");
    expect(queryToolFor({ id: "mod", mode: "mock" })).toBe("mod_correlate");
    expect(queryToolFor({ id: "custom", mode: "mock" })).toBe("correlate");
    expect(queryToolFor({ id: "def", mode: "mcp", command: "x", queryTool: "other" })).toBe("other");
  });
});
