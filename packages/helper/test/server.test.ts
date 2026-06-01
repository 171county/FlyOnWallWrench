import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHelper } from "../src/server.js";

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
});
