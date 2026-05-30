import { afterEach, describe, expect, it, vi } from "vitest";
import { mockWorkspaceContext } from "@help-me-comms/core";
import { CustomSourceAdapter } from "../src/index.js";

const ctx = mockWorkspaceContext;
afterEach(() => vi.restoreAllMocks());

describe("CustomSourceAdapter", () => {
  it("reads a Discourse latest/search feed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ topic_list: { topics: [{ title: "CTD at boss after update", slug: "ctd-boss", id: 7, created_at: new Date().toISOString() }] } }) } as Response)));
    const a = new CustomSourceAdapter({ id: "f1", label: "My Forum", type: "discourse", url: "https://forum.example.com" });
    const ev = await a.search({ query: "ctd boss", intent: "crash_support", maxEvidence: 10 }, ctx);
    expect(ev.length).toBe(1);
    expect(ev[0].sourceUrl).toContain("/t/ctd-boss/7");
    expect(a.capabilities.write).toBe("disabled");
  });

  it("parses an RSS feed and filters by query", async () => {
    const xml = `<rss><channel><item><title>Boss intro crash hotfix</title><link>https://x/1</link><pubDate>${new Date().toUTCString()}</pubDate></item><item><title>unrelated devlog</title><link>https://x/2</link></item></channel></rss>`;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => xml } as Response)));
    const a = new CustomSourceAdapter({ id: "r1", label: "Devlog", type: "rss", url: "https://x/feed.xml" });
    const ev = await a.search({ query: "crash hotfix", intent: "crash_support", maxEvidence: 10 }, ctx);
    expect(ev.length).toBe(1);
    expect(ev[0].title).toMatch(/hotfix/i);
  });
});
