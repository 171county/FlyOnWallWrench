import { afterEach, describe, expect, it, vi } from "vitest";
import { mockWorkspaceContext } from "@help-me-comms/core";
import { GithubReadAdapter, githubReadFromEnv, createAdapters } from "../src/index.js";

const ctx = mockWorkspaceContext;
const now = new Date().toISOString();

function fakeGithub(items: unknown[]) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items }) } as Response));
}
afterEach(() => vi.restoreAllMocks());

describe("GithubReadAdapter", () => {
  it("reads issues, skips PRs, counts comments+reactions as confirmations", async () => {
    vi.stubGlobal("fetch", fakeGithub([
      { number: 1, title: "CTD at factory boss", body: "crashes after patch", created_at: now, comments: 4, reactions: { total_count: 6 }, html_url: "https://x/1", state: "open" },
      { number: 2, title: "a pull request", body: "code", created_at: now, pull_request: {}, html_url: "https://x/2" },
    ]));
    const a = new GithubReadAdapter({ repos: ["owner/repo"] });
    const ev = await a.search({ query: "ctd boss", intent: "crash_support", maxEvidence: 10 }, ctx);
    expect(ev).toHaveLength(1);                       // PR skipped
    expect(ev[0].source).toBe("github_issues");
    expect(ev[0].confidenceSignals.confirmationCount).toBe(10); // 4 + 6
    expect(ev[0].sourceUrl).toBe("https://x/1");
  });

  it("write disabled; env gating works (token optional)", () => {
    expect(new GithubReadAdapter({ repos: ["a/b"] }).capabilities.write).toBe("disabled");
    expect(githubReadFromEnv({})).toBeNull();
    expect(githubReadFromEnv({ HELP_ME_GITHUB_REPOS: "a/b" })).toBeInstanceOf(GithubReadAdapter); // no token ok
    expect(createAdapters({ HELP_ME_GITHUB_REPOS: "a/b" })[4]).toBeInstanceOf(GithubReadAdapter);
  });
});
