import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class HelpdeskAdapter extends BaseMockAdapter {
  constructor() {
    super("helpdesk" as const, { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
