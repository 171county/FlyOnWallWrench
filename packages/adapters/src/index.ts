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

import type { CommsSourceAdapter } from "@help-me-comms/core";
import { DiscordAdapter } from "./discordAdapter.js";
import { RedditAdapter } from "./redditAdapter.js";
import { SteamReviewsAdapter } from "./steamAdapter.js";
import { ForumAdapter } from "./forumAdapter.js";
import { GithubDiscussionsAdapter } from "./githubAdapter.js";
import { discordReadFromEnv } from "./discordReadAdapter.js";

export function createDefaultMockAdapters(): CommsSourceAdapter[] {
  return [
    new DiscordAdapter(),
    new RedditAdapter(),
    new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter(),
  ];
}

// Same default set, but swap in the REAL Discord read adapter when credentials
// are present in the environment. Everything else stays on the safe mock until
// its own real adapter ships. Token/IDs are read here and never persisted.
export function createAdapters(env: Record<string, string | undefined> = {}): CommsSourceAdapter[] {
  const discordReal = discordReadFromEnv(env);
  return [
    discordReal ?? new DiscordAdapter(),
    new RedditAdapter(),
    new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter(),
  ];
}
