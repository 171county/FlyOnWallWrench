export * from "./baseMockAdapter.js";
export * from "./discordAdapter.js";
export * from "./redditAdapter.js";
export * from "./steamAdapter.js";
export * from "./forumAdapter.js";
export * from "./githubAdapter.js";
export * from "./youtubeAdapter.js";
export * from "./twitchAdapter.js";
export * from "./slackAdapter.js";
export * from "./matrixAdapter.js";
export * from "./helpdeskAdapter.js";
export * from "./discordReadAdapter.js";
export * from "./steamReadAdapter.js";
export * from "./redditReadAdapter.js";

import type { CommsSourceAdapter } from "@help-me-comms/core";
import { DiscordAdapter } from "./discordAdapter.js";
import { RedditAdapter } from "./redditAdapter.js";
import { SteamReviewsAdapter } from "./steamAdapter.js";
import { ForumAdapter } from "./forumAdapter.js";
import { GithubDiscussionsAdapter } from "./githubAdapter.js";
import { discordReadFromEnv } from "./discordReadAdapter.js";
import { steamReadFromEnv } from "./steamReadAdapter.js";
import { redditReadFromEnv } from "./redditReadAdapter.js";

export function createDefaultMockAdapters(): CommsSourceAdapter[] {
  return [
    new DiscordAdapter(),
    new RedditAdapter(),
    new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter(),
  ];
}

// Same default set, but swap in REAL read adapters when credentials are present
// in the environment. Each source stays on its safe mock until configured.
// Tokens/IDs are read here and never persisted by this package.
export function createAdapters(env: Record<string, string | undefined> = {}): CommsSourceAdapter[] {
  return [
    discordReadFromEnv(env) ?? new DiscordAdapter(),
    redditReadFromEnv(env) ?? new RedditAdapter(),
    steamReadFromEnv(env) ?? new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter(),
  ];
}
