import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class ForumAdapter extends BaseMockAdapter {
  constructor() {
    super("forum" as const, { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
