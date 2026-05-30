import { afterEach, describe, expect, it, vi } from "vitest";
import { mockWorkspaceContext } from "@help-me-comms/core";
import { SteamReadAdapter, steamReadFromEnv, createAdapters } from "../src/index.js";

const ctx = mockWorkspaceContext;
const now = Math.floor(Date.now() / 1000);

function fakeSteam(reviews: unknown[]) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: 1, reviews }) } as Response));
}
afterEach(() => vi.restoreAllMocks());

describe("SteamReadAdapter", () => {
  it("reads reviews and matches query terms", async () => {
    vi.stubGlobal("fetch", fakeSteam([
      { recommendationid: "1", review: "crashes at the boss intro after the patch", timestamp_created: now, voted_up: false, votes_up: 8 },
      { recommendationid: "2", review: "love this game", timestamp_created: now, voted_up: true, votes_up: 3 },
    ]));
    const a = new SteamReadAdapter({ appIds: ["1234"] });
    const ev = await a.search({ query: "crashes boss", intent: "crash_support", maxEvidence: 10 }, ctx);
    expect(ev).toHaveLength(1);
    expect(ev[0].source).toBe("steam_reviews");
    expect(ev[0].confidenceSignals.confirmationCount).toBe(8);
    expect(ev[0].redacted).toBe(true);
  });

  it("write disabled; env gating works", () => {
    expect(new SteamReadAdapter({ appIds: ["1"] }).capabilities.write).toBe("disabled");
    expect(steamReadFromEnv({})).toBeNull();
    expect(steamReadFromEnv({ HELP_ME_STEAM_APP_IDS: "1234,5678" })).toBeInstanceOf(SteamReadAdapter);
    expect(createAdapters({ HELP_ME_STEAM_APP_IDS: "1234" })[2]).toBeInstanceOf(SteamReadAdapter);
  });
});
