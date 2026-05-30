import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class SlackAdapter extends BaseMockAdapter {
  constructor() {
    super("slack" as const, { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
