import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class YoutubeAdapter extends BaseMockAdapter {
  constructor() {
    super("youtube" as const, { supportsRealtime: true });
  }
}
