import { afterEach, describe, expect, it, vi } from "vitest";
import { mockWorkspaceContext } from "@help-me-comms/core";
import { DiscordReadAdapter, createAdapters, discordReadFromEnv } from "../src/index.js";

const ctx = mockWorkspaceContext;

function fakeDiscord(messagesByChannel: Record<string, unknown[]>) {
  return vi.fn(async (url: string) => {
    const m = /channels\/([^/]+)\/messages/.exec(String(url));
    const channelId = m?.[1] ?? "";
    return {
      ok: true,
      status: 200,
      json: async () => messagesByChannel[channelId] ?? [],
    } as Response;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("DiscordReadAdapter", () => {
  it("reads only approved channels, skips bots, matches query terms", async () => {
    vi.stubGlobal("fetch", fakeDiscord({
      "approved1": [
        { id: "1", content: "anyone else crashing at the boss?", timestamp: new Date().toISOString(), author: { username: "a", bot: false } },
        { id: "2", content: "beep boop", timestamp: new Date().toISOString(), author: { username: "bot", bot: true } },
        { id: "3", content: "totally unrelated chatter", timestamp: new Date().toISOString(), author: { username: "c", bot: false } },
      ],
    }));

    const adapter = new DiscordReadAdapter({ botToken: "x", approvedChannelIds: ["approved1"] });
    const evidence = await adapter.search({ query: "crashing boss", intent: "crash_support", maxEvidence: 10 }, ctx);

    expect(evidence).toHaveLength(1);                 // only the matching, non-bot message
    expect(evidence[0].summary).toContain("crashing");
    expect(evidence[0].source).toBe("discord");
    expect(evidence[0].redacted).toBe(true);          // bodies are ephemeral evidence
  });

  it("getThread refuses channels that are not approved", async () => {
    vi.stubGlobal("fetch", fakeDiscord({ secret: [{ id: "9", content: "x", timestamp: new Date().toISOString() }] }));
    const adapter = new DiscordReadAdapter({ botToken: "x", approvedChannelIds: ["approved1"] });
    const thread = await adapter.getThread({ source: "discord", externalId: "secret" }, ctx);
    expect(thread.items).toHaveLength(0);
    expect(thread.title).toMatch(/not approved/i);
  });

  it("write is disabled at the adapter level", () => {
    const adapter = new DiscordReadAdapter({ botToken: "x", approvedChannelIds: ["a"] });
    expect(adapter.capabilities.write).toBe("disabled");
  });

  it("env gating: no creds -> null, falls back to mock", () => {
    expect(discordReadFromEnv({})).toBeNull();
    expect(discordReadFromEnv({ HELP_ME_DISCORD_BOT_TOKEN: "t" })).toBeNull(); // needs channel ids too
    const adapters = createAdapters({}); // no env
    expect(adapters[0].constructor.name).toBe("DiscordAdapter"); // the mock
  });

  it("env gating: with creds -> real Discord read adapter is used", () => {
    const real = discordReadFromEnv({ HELP_ME_DISCORD_BOT_TOKEN: "t", HELP_ME_DISCORD_CHANNEL_IDS: "1,2" });
    expect(real).toBeInstanceOf(DiscordReadAdapter);
    const adapters = createAdapters({ HELP_ME_DISCORD_BOT_TOKEN: "t", HELP_ME_DISCORD_CHANNEL_IDS: "1,2" });
    expect(adapters[0]).toBeInstanceOf(DiscordReadAdapter);
  });
});
