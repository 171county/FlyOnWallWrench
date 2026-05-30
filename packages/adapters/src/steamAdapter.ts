import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class SteamReviewsAdapter extends BaseMockAdapter {
  constructor() {
    super("steam_reviews" as const, { write: "disabled", supportsThreads: false });
  }
}
