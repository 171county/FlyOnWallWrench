import type { ActionPlan, ActionType } from "./types.js";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createActionPlan(input: {
  actionType: ActionType;
  draft: string;
  targetRef?: string;
  targetSummary?: string;
  evidenceRefs?: string[];
  allowedClient?: "web_app" | "browser_extension" | "vscode_extension" | "ai_client";
}): ActionPlan {
  return {
    actionId: id("act"),
    actionType: input.actionType,
    targetRef: input.targetRef,
    targetSummary: input.targetSummary,
    draft: input.draft,
    approvalRequired: true,
    clientActions: [
      {
        type: "present_for_user_approval",
        allowedClient: input.allowedClient ?? "web_app",
        requiresVisibleUserConfirmation: true,
      },
    ],
    evidenceRefs: input.evidenceRefs ?? [],
    status: "drafted",
  };
}

export function queueAction(plan: ActionPlan): ActionPlan {
  return {
    ...plan,
    approvalRequired: true,
    status: "queued",
  };
}
