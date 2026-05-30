import type { CommsSourceAdapter } from "./sourceAdapter.js";
import type { CommunityHelpRequest, HelpAnswer, SourceKind, WorkspaceContext } from "./types.js";
import { classifyIntent, selectSources } from "./router.js";
import { aggregateConfidence, rankEvidence } from "./evidenceRanker.js";
import { privacyNotice } from "./privacyRedactor.js";

export async function communityHelp(
  request: CommunityHelpRequest,
  context: WorkspaceContext,
  adapters: CommsSourceAdapter[],
): Promise<HelpAnswer> {
  const intent = classifyIntent(request.userMessage);
  const selectedSources = new Set<SourceKind>(selectSources(intent, context));
  const selectedAdapters = adapters.filter((adapter) => selectedSources.has(adapter.kind));

  if (selectedAdapters.length === 0) {
    return {
      status: "no_relevant_sources",
      workspaceId: context.workspaceId,
      intent,
      confidence: 0,
      answer: "I do not see relevant connected communication sources for this request yet.",
      sourcesUsed: [],
      evidence: [],
      suggestedActions: [
        { type: "connect_source", label: "Connect a community source for this workspace", requiresApproval: true },
      ],
      privacyNotice: privacyNotice(context.defaultPolicy.retention),
    };
  }

  const evidence = rankEvidence(
    (
      await Promise.all(
        selectedAdapters.map((adapter) =>
          adapter.search(
            {
              query: request.userMessage,
              intent,
              projectHint: request.projectHint,
              timeWindow: request.timeWindow ?? "14d",
              maxEvidence: 10,
            },
            context,
          ),
        ),
      )
    ).flat(),
  ).slice(0, 10);

  const confidence = aggregateConfidence(evidence);
  const sourcesUsed = [...new Set(evidence.map((item) => item.source))];

  const answer = buildConversationalAnswer(request.userMessage, intent, confidence, evidence);
  const followupQuestion = confidence < 0.72 ? followupForIntent(intent) : undefined;

  return {
    status: followupQuestion ? "needs_followup" : "ok",
    workspaceId: context.workspaceId,
    intent,
    confidence,
    answer,
    followupQuestion,
    sourcesUsed,
    evidence,
    suggestedActions: suggestedActionsForIntent(intent),
    privacyNotice: privacyNotice(context.defaultPolicy.retention),
  };
}

function buildConversationalAnswer(
  userMessage: string,
  intent: string,
  confidence: number,
  evidence: Array<{ title: string; summary: string }>,
): string {
  if (evidence.length === 0) {
    return "I could not find enough connected community evidence yet. I can still help draft a troubleshooting checklist if you provide version, platform, and any logs or mod list details.";
  }

  const top = evidence.slice(0, 3).map((item, index) => `${index + 1}. ${item.summary}`).join("\n");

  if (intent === "crash_support") {
    return `This looks like a crash-support issue. Based on the strongest matching community evidence, start with these steps:\n\n${top}\n\nConfidence: ${Math.round(confidence * 100)}%.`;
  }

  if (intent === "performance_bottleneck") {
    return `I found related performance/bottleneck chatter. The strongest pattern is:\n\n${top}\n\nConfidence: ${Math.round(confidence * 100)}%.`;
  }

  if (intent === "idea_pull") {
    return `I found repeated idea/request signals. The top themes are:\n\n${top}\n\nConfidence: ${Math.round(confidence * 100)}%.`;
  }

  return `I found relevant community evidence for: "${userMessage}".\n\n${top}\n\nConfidence: ${Math.round(confidence * 100)}%.`;
}

function followupForIntent(intent: string): string | undefined {
  if (intent === "crash_support") return "What platform, game/mod version, and recent changes are involved?";
  if (intent === "performance_bottleneck") return "What hardware or server setup, location/stage, and patch version are involved?";
  if (intent === "install_help") return "Can you share the exact error message and whether this is a fresh install or update?";
  return "Can you share one more detail so I can narrow the search?";
}

function suggestedActionsForIntent(intent: string) {
  if (intent === "crash_support") {
    return [
      { type: "draft_faq", label: "Draft a known-issue FAQ", requiresApproval: true },
      { type: "draft_reply", label: "Draft a support reply asking for logs and version", requiresApproval: true },
    ];
  }

  if (intent === "performance_bottleneck") {
    return [
      { type: "draft_report_template", label: "Draft a performance report template", requiresApproval: true },
      { type: "draft_poll", label: "Draft a poll to collect affected setups", requiresApproval: true },
    ];
  }

  return [{ type: "draft_reply", label: "Draft a response", requiresApproval: true }];
}
