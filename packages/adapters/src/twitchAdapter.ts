import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class TwitchAdapter extends BaseMockAdapter {
  constructor() {
    super("twitch" as const, { supportsRealtime: true });
  }
}
