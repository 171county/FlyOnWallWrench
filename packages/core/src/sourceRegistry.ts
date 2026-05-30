import type { CommsSourceAdapter } from "./sourceAdapter.js";
import type { SourceKind, WorkspaceContext } from "./types.js";

export class SourceRegistry {
  private adapters = new Map<SourceKind, CommsSourceAdapter>();

  register(adapter: CommsSourceAdapter): void {
    this.adapters.set(adapter.kind, adapter);
  }

  get(kind: SourceKind): CommsSourceAdapter | undefined {
    return this.adapters.get(kind);
  }

  list(): CommsSourceAdapter[] {
    return [...this.adapters.values()];
  }

  connectedForWorkspace(context: WorkspaceContext): CommsSourceAdapter[] {
    const connected = new Set(context.connectedSources.filter((s) => s.read).map((s) => s.source));
    return this.list().filter((adapter) => connected.has(adapter.kind));
  }
}
