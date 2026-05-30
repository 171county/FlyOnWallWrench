import {
  communityHelp,
  createActionPlan,
  mockWorkspaceContext,
  queueAction,
  type ActionType,
} from "@help-me-comms/core";
import { createAdapters } from "@help-me-comms/adapters";

const adapters = createAdapters(process.env);

export async function getWorkspaceContextTool(args: { workspace_id?: string }) {
  return {
    ...mockWorkspaceContext,
    workspaceId: args.workspace_id ?? mockWorkspaceContext.workspaceId,
  };
}

export async function communityHelpTool(args: {
  workspace_id?: string;
  conversation_id?: string;
  user_message: string;
  project_hint?: string;
  mode?: "answer_user" | "community_manager" | "developer_triage" | "draft_action" | "idea_pull" | "idea_push";
  source_policy?: "auto_scope_connected_sources" | "use_connected_sources_only" | "target_thread_only" | "ask_before_extra_sources";
  time_window?: string;
  return_mode?: "answer" | "evidence_pack" | "action_plan" | "full";
}) {
  const context = await getWorkspaceContextTool({ workspace_id: args.workspace_id });
  return communityHelp(
    {
      workspaceId: args.workspace_id,
      conversationId: args.conversation_id,
      userMessage: args.user_message,
      projectHint: args.project_hint,
      mode: args.mode,
      sourcePolicy: args.source_policy,
      timeWindow: args.time_window,
      returnMode: args.return_mode,
    },
    context,
    adapters,
  );
}

export async function getCommsThreadTool(args: {
  workspace_id?: string;
  source_ref: string;
  include_context?: boolean;
}) {
  const context = await getWorkspaceContextTool({ workspace_id: args.workspace_id });
  const [source, externalId] = args.source_ref.split("://");
  const adapter = adapters.find((item) => item.kind === source);

  if (!adapter) {
    return { status: "error", message: `No adapter registered for ${source}` };
  }

  return adapter.getThread({ source: adapter.kind, externalId: externalId ?? args.source_ref, url: args.source_ref }, context);
}

export async function draftCommsActionTool(args: {
  workspace_id?: string;
  objective: string;
  target_ref?: string;
  tone?: string;
  evidence_refs?: string[];
  action_type?: ActionType;
}) {
  return createActionPlan({
    actionType: args.action_type ?? "reply",
    targetRef: args.target_ref,
    targetSummary: args.objective,
    draft: `Draft placeholder. Objective: ${args.objective}. Tone: ${args.tone ?? "helpful and direct"}.`,
    evidenceRefs: args.evidence_refs ?? [],
    allowedClient: "web_app",
  });
}

export async function queueCommsActionTool(args: {
  workspace_id?: string;
  action_type: ActionType;
  target_ref?: string;
  draft: string;
}) {
  return queueAction(
    createActionPlan({
      actionType: args.action_type,
      targetRef: args.target_ref,
      draft: args.draft,
      allowedClient: "web_app",
    }),
  );
}

export async function suggestMoreSourcesTool(args: {
  workspace_id?: string;
  last_intent?: string;
  sources_used?: string[];
  user_goal?: string;
}) {
  const context = await getWorkspaceContextTool({ workspace_id: args.workspace_id });
  const used = new Set(args.sources_used ?? []);
  return {
    workspaceId: context.workspaceId,
    recommendedNextSources: context.availableButNotEnabled
      .filter((source) => !used.has(source))
      .slice(0, 3)
      .map((source) => ({
        source,
        reason: `May improve coverage for ${args.last_intent ?? args.user_goal ?? "this workflow"}.`,
      })),
  };
}
