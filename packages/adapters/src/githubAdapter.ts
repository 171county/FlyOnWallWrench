import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class GithubDiscussionsAdapter extends BaseMockAdapter {
  constructor() {
    super("github_discussions" as const, { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
