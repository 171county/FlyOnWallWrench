export type SourceKind =
  | "discord"
  | "reddit"
  | "steam_reviews"
  | "steam_news"
  | "steam_discussions"
  | "forum"
  | "github_discussions"
  | "github_issues"
  | "youtube"
  | "twitch"
  | "slack"
  | "matrix"
  | "app_store_reviews"
  | "social"
  | "helpdesk"
  | "mock";

export type WritePolicy = "disabled" | "draft_only" | "approval_required" | "enabled";

export type HelpIntent =
  | "crash_support"
  | "performance_bottleneck"
  | "install_help"
  | "compatibility_question"
  | "known_issue_check"
  | "community_sentiment"
  | "idea_pull"
  | "idea_push"
  | "reply_drafting"
  | "announcement_drafting"
  | "triage"
  | "unknown";

export type SourceCapabilities = {
  source: SourceKind;
  read: boolean;
  write: WritePolicy;
  supportsThreads: boolean;
  supportsSearch: boolean;
  supportsRealtime: boolean;
  supportsPrivateSpaces: boolean;
  supportsUserOwnedRetention: boolean;
  approvedSpaces?: string[];
};

export type WorkspaceContext = {
  workspaceId: string;
  projects: string[];
  connectedSources: SourceCapabilities[];
  availableButNotEnabled: SourceKind[];
  providerMode: "host_model" | "bring_your_own" | "local" | "unset";
  defaultPolicy: {
    autoAnswerPrivateHelp: boolean;
    publicPosting: "approval_required" | "disabled" | "enabled";
    moderation: "disabled" | "approval_required" | "enabled";
    privateDms: "disabled" | "approval_required" | "enabled";
    retention: "ephemeral" | "user_owned";
  };
};

export type SourceRef = {
  source: SourceKind;
  externalId: string;
  url?: string;
};

export type CommsItem = {
  id: string;
  source: SourceKind;
  projectId?: string;
  threadId?: string;
  parentId?: string;
  authorRef: string;
  authorRole?: "player" | "modder" | "developer" | "moderator" | "creator" | "unknown";
  body: string;
  createdAt: string;
  url?: string;
  visibility: "public" | "private" | "team" | "approved_channel";
  permissions: {
    canQuote: boolean;
    canReply: boolean;
    canSummarize: boolean;
  };
  signals?: {
    sentiment?: "positive" | "neutral" | "negative" | "mixed";
    urgency?: "low" | "medium" | "high";
    ideaCandidate?: boolean;
    bugCandidate?: boolean;
    toxicityRisk?: "low" | "medium" | "high";
  };
};

export type ThreadContext = {
  ref: SourceRef;
  title?: string;
  items: CommsItem[];
  sourceUrl?: string;
  redacted: boolean;
};

export type EvidenceItem = {
  id: string;
  source: SourceKind;
  title: string;
  summary: string;
  sourceUrl?: string;
  createdAt?: string;
  matchedTerms: string[];
  confidenceSignals: {
    semanticMatch: number;
    exactTermMatch: number;
    recency: number;
    sourceTrust: number;
    confirmationCount: number;
    sameVersionBonus: number;
    resolvedBonus: number;
    duplicatePenalty: number;
    lowQualityPenalty: number;
  };
  redacted: boolean;
};

export type CommunityHelpRequest = {
  workspaceId?: string;
  conversationId?: string;
  userMessage: string;
  projectHint?: string;
  mode?: "answer_user" | "community_manager" | "developer_triage" | "draft_action" | "idea_pull" | "idea_push";
  sourcePolicy?: "auto_scope_connected_sources" | "use_connected_sources_only" | "target_thread_only" | "ask_before_extra_sources";
  timeWindow?: string;
  returnMode?: "answer" | "evidence_pack" | "action_plan" | "full";
};

export type SourceSearchRequest = {
  query: string;
  intent: HelpIntent;
  projectHint?: string;
  timeWindow?: string;
  maxEvidence?: number;
};

export type SuggestedAction = {
  type: string;
  label: string;
  targetRef?: string;
  requiresApproval: boolean;
};

export type HelpAnswer = {
  status: "ok" | "needs_followup" | "no_relevant_sources" | "error";
  workspaceId: string;
  intent: HelpIntent;
  confidence: number;
  answer: string;
  followupQuestion?: string;
  sourcesUsed: SourceKind[];
  evidence: EvidenceItem[];
  suggestedActions: SuggestedAction[];
  privacyNotice: string;
};

export type ActionType =
  | "reply"
  | "announcement"
  | "poll"
  | "faq"
  | "known_issue"
  | "idea_card"
  | "triage_card"
  | "internal_digest"
  | "browser_insert"
  | "vscode_diff"
  | "vscode_task";

export type ActionPlan = {
  actionId: string;
  actionType: ActionType;
  targetRef?: string;
  targetSummary?: string;
  draft: string;
  approvalRequired: boolean;
  clientActions: Array<{
    type: string;
    allowedClient: "web_app" | "browser_extension" | "vscode_extension" | "ai_client";
    requiresVisibleUserConfirmation: boolean;
  }>;
  evidenceRefs: string[];
  status: "drafted" | "queued" | "approved" | "rejected" | "expired";
};

export type HelpSession = {
  conversationId: string;
  workspaceId: string;
  projectId?: string;
  detectedIntent?: HelpIntent;
  knownFacts: Record<string, unknown>;
  missingFacts: string[];
  evidenceRefs: string[];
  lastAnswer?: string;
  pendingActionIds?: string[];
};
