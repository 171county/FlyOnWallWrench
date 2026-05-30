#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  communityHelpTool,
  draftCommsActionTool,
  getCommsThreadTool,
  getWorkspaceContextTool,
  queueCommsActionTool,
  suggestMoreSourcesTool,
} from "./toolRuntime.js";

const server = new McpServer({
  name: "help-me-comms-mcp",
  version: "0.1.0",
});

function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

server.tool(
  "get_workspace_context",
  "Return connected sources, source capabilities, projects, provider mode, write policy, and privacy settings.",
  {
    workspace_id: z.string().optional(),
  },
  async (args) => jsonText(await getWorkspaceContextTool(args)),
);

server.tool(
  "community_help",
  "Conversational community help: scope the request, retrieve evidence, and return an answer, follow-up, draft, or action plan.",
  {
    workspace_id: z.string().optional(),
    conversation_id: z.string().optional(),
    user_message: z.string(),
    project_hint: z.string().optional(),
    mode: z.enum(["answer_user", "community_manager", "developer_triage", "draft_action", "idea_pull", "idea_push"]).optional(),
    source_policy: z.enum(["auto_scope_connected_sources", "use_connected_sources_only", "target_thread_only", "ask_before_extra_sources"]).optional(),
    time_window: z.string().optional(),
    return_mode: z.enum(["answer", "evidence_pack", "action_plan", "full"]).optional(),
  },
  async (args) => jsonText(await communityHelpTool(args)),
);

server.tool(
  "get_comms_thread",
  "Fetch one exact thread or conversation from a connected source.",
  {
    workspace_id: z.string().optional(),
    source_ref: z.string(),
    include_context: z.boolean().optional(),
  },
  async (args) => jsonText(await getCommsThreadTool(args)),
);

server.tool(
  "draft_comms_action",
  "Draft a reply, announcement, poll, FAQ, known-issue post, idea card, or triage card from evidence.",
  {
    workspace_id: z.string().optional(),
    objective: z.string(),
    target_ref: z.string().optional(),
    tone: z.string().optional(),
    evidence_refs: z.array(z.string()).optional(),
    action_type: z.enum(["reply", "announcement", "poll", "faq", "known_issue", "idea_card", "triage_card", "internal_digest", "browser_insert", "vscode_diff", "vscode_task"]).optional(),
  },
  async (args) => jsonText(await draftCommsActionTool(args)),
);

server.tool(
  "queue_comms_action",
  "Queue a draft/action plan for visible user approval. Public writes must use this path by default.",
  {
    workspace_id: z.string().optional(),
    action_type: z.enum(["reply", "announcement", "poll", "faq", "known_issue", "idea_card", "triage_card", "internal_digest", "browser_insert", "vscode_diff", "vscode_task"]),
    target_ref: z.string().optional(),
    draft: z.string(),
  },
  async (args) => jsonText(await queueCommsActionTool(args)),
);

server.tool(
  "suggest_more_sources",
  "Recommend optional sources after an answer when confidence or coverage could improve.",
  {
    workspace_id: z.string().optional(),
    last_intent: z.string().optional(),
    sources_used: z.array(z.string()).optional(),
    user_goal: z.string().optional(),
  },
  async (args) => jsonText(await suggestMoreSourcesTool(args)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
