import { afterEach, describe, expect, it, vi } from "vitest";
import { mockWorkspaceContext } from "@help-me-comms/core";
import { RedditReadAdapter, redditReadFromEnv, createAdapters } from "../src/index.js";

const ctx = mockWorkspaceContext;
const now = Math.floor(Date.now() / 1000);

function fakeReddit(children: unknown[]) {
  return vi.fn(async (url: string) => {
    if (String(url).includes("access_token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 3600 }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({ data: { children } }) } as Response;
  });
}
afterEach(() => vi.restoreAllMocks());

describe("RedditReadAdapter", () => {
  it("authenticates then reads + matches posts", async () => {
    vi.stubGlobal("fetch", fakeReddit([
      { data: { id: "a1", title: "Anyone else crashing at the boss?", selftext: "post-patch CTD", created_utc: now, ups: 42, permalink: "/r/x/a1" } },
      { data: { id: "a2", title: "great update", selftext: "", created_utc: now, ups: 5 } },
    ]));
    const a = new RedditReadAdapter({ clientId: "c", clientSecret: "s", subreddits: ["x"] });
    const ev = await a.search({ query: "crashing boss", intent: "crash_support", maxEvidence: 10 }, ctx);
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev[0].source).toBe("reddit");
    expect(ev[0].sourceUrl).toContain("reddit.com");
  });

  it("write disabled; env gating works", () => {
    expect(new RedditReadAdapter({ clientId: "c", clientSecret: "s", subreddits: ["x"] }).capabilities.write).toBe("disabled");
    expect(redditReadFromEnv({})).toBeNull();
    expect(redditReadFromEnv({ HELP_ME_REDDIT_CLIENT_ID: "c" })).toBeNull(); // needs all three
    expect(redditReadFromEnv({ HELP_ME_REDDIT_CLIENT_ID: "c", HELP_ME_REDDIT_CLIENT_SECRET: "s", HELP_ME_REDDIT_SUBREDDITS: "x" })).toBeInstanceOf(RedditReadAdapter);
    expect(createAdapters({ HELP_ME_REDDIT_CLIENT_ID: "c", HELP_ME_REDDIT_CLIENT_SECRET: "s", HELP_ME_REDDIT_SUBREDDITS: "x" })[1]).toBeInstanceOf(RedditReadAdapter);
  });
});
