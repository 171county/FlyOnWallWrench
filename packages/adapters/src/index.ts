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

import type { CommsSourceAdapter } from "@help-me-comms/core";
import { DiscordAdapter } from "./discordAdapter.js";
import { RedditAdapter } from "./redditAdapter.js";
import { SteamReviewsAdapter } from "./steamAdapter.js";
import { ForumAdapter } from "./forumAdapter.js";
import { GithubDiscussionsAdapter } from "./githubAdapter.js";

export function createDefaultMockAdapters(): CommsSourceAdapter[] {
  return [
    new DiscordAdapter(),
    new RedditAdapter(),
    new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter(),
  ];
}
