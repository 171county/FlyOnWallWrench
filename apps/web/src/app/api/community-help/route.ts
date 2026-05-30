import { NextRequest } from "next/server";
import { communityHelp, mockWorkspaceContext } from "@help-me-comms/core";
import { createDefaultMockAdapters } from "@help-me-comms/adapters";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const answer = await communityHelp(
    {
      userMessage: body.user_message ?? body.userMessage ?? "",
      workspaceId: body.workspace_id,
      conversationId: body.conversation_id,
      projectHint: body.project_hint,
      mode: body.mode,
      sourcePolicy: body.source_policy,
      timeWindow: body.time_window,
      returnMode: body.return_mode,
    },
    mockWorkspaceContext,
    createDefaultMockAdapters(),
  );

  return Response.json(answer);
}
