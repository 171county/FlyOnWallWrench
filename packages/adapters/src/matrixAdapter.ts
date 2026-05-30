import { BaseMockAdapter } from "./baseMockAdapter.js";

// TODO: Replace this mock adapter with official API integration and source-specific consent checks.
export class MatrixAdapter extends BaseMockAdapter {
  constructor() {
    super("matrix" as const, { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
}
