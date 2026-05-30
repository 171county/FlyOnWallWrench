import type {
  ActionPlan,
  SourceCapabilities,
  SourceKind,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
  EvidenceItem,
} from "./types.js";

export type DraftActionRequest = {
  objective: string;
  targetRef?: string;
  evidenceRefs?: string[];
  tone?: string;
};

export interface CommsSourceAdapter {
  kind: SourceKind;
  capabilities: SourceCapabilities;
  search(request: SourceSearchRequest, context: WorkspaceContext): Promise<EvidenceItem[]>;
  getThread(ref: SourceRef, context: WorkspaceContext): Promise<ThreadContext>;
  prepareAction?(request: DraftActionRequest, context: WorkspaceContext): Promise<ActionPlan>;
}
