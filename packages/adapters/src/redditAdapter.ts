import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class RedditAdapter extends BaseMockAdapter {
  constructor() {
    super("reddit" as const, { supportsPrivateSpaces: false });
  }
}
