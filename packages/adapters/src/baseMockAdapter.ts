import type {
  CommsSourceAdapter,
  EvidenceItem,
  SourceCapabilities,
  SourceKind,
  SourceRef,
  SourceSearchRequest,
  ThreadContext,
  WorkspaceContext,
} from "@help-me-comms/core";

function syntheticEvidence(kind: SourceKind, query: string, intent: string): EvidenceItem[] {
  const q = query.toLowerCase();
  const crash = /(crash|ctd|freeze|boss|stage)/.test(q);
  const perf = /(bottleneck|fps|stutter|cpu|gpu|performance)/.test(q);

  const summaries = crash
    ? [
        "Several users mention crashes around the same stage transition after the latest patch.",
        "A moderator suggested verifying files, disabling recent visual/animation changes, and retesting from an earlier save.",
      ]
    : perf
      ? [
          "Multiple users describe frame pacing drops in dense areas after the update.",
          "Reports cluster around CPU-heavy scenes and script/mod load rather than pure GPU limits.",
        ]
      : [
          "Community discussion contains related reports and practical follow-up questions.",
          "The strongest next step is to gather version, platform, and reproduction details.",
        ];

  return summaries.map((summary, index) => ({
    id: `${kind}_ev_${index + 1}`,
    source: kind,
    title: `${kind} synthetic evidence ${index + 1}`,
    summary,
    sourceUrl: undefined,
    createdAt: new Date().toISOString(),
    matchedTerms: query.split(/\s+/).slice(0, 5),
    confidenceSignals: {
      semanticMatch: 0.72 - index * 0.08,
      exactTermMatch: crash || perf ? 0.75 : 0.45,
      recency: 0.8,
      sourceTrust: 0.7,
      confirmationCount: index === 0 ? 6 : 2,
      sameVersionBonus: 0.4,
      resolvedBonus: 0.1,
      duplicatePenalty: 0,
      lowQualityPenalty: 0.05,
    },
    redacted: true,
  }));
}

export class BaseMockAdapter implements CommsSourceAdapter {
  kind: SourceKind;
  capabilities: SourceCapabilities;

  constructor(kind: SourceKind, overrides: Partial<SourceCapabilities> = {}) {
    this.kind = kind;
    this.capabilities = {
      source: kind,
      read: true,
      write: "approval_required",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      ...overrides,
    };
  }

  async search(request: SourceSearchRequest, _context: WorkspaceContext): Promise<EvidenceItem[]> {
    return syntheticEvidence(this.kind, request.query, request.intent).slice(0, request.maxEvidence ?? 10);
  }

  async getThread(ref: SourceRef, _context: WorkspaceContext): Promise<ThreadContext> {
    return {
      ref,
      title: `${this.kind} thread placeholder`,
      items: [
        {
          id: `${this.kind}_item_1`,
          source: this.kind,
          threadId: ref.externalId,
          authorRef: "redacted_author",
          authorRole: "unknown",
          body: "Synthetic thread item for local demo. Replace with real source retrieval.",
          createdAt: new Date().toISOString(),
          visibility: "public",
          permissions: { canQuote: false, canReply: false, canSummarize: true },
        },
      ],
      redacted: true,
    };
  }
}
