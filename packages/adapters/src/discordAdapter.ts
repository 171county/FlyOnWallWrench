import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class DiscordAdapter extends BaseMockAdapter {
  constructor() {
    super("discord" as const, { supportsRealtime: true, supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
