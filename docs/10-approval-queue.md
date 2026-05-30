# Approval queue

## Purpose

The approval queue is the safety layer between generated drafts and real-world actions.

## Action types

- Reply draft
- Announcement draft
- Poll draft
- Forum post draft
- Known-issue draft
- FAQ draft
- Idea card
- Triage card
- Issue draft
- Browser insert action
- VS Code diff proposal
- VS Code task proposal

## Default policy

```text
Read: allowed within authorized scopes
Draft: allowed
Queue: allowed
Publish/reply: approval required
Moderation: disabled by default
DMs: disabled by default
Local edits: approval required
Terminal commands: approval required
```

## Approval record

Approval metadata may be stored, but sensitive content should be redacted or omitted according to retention policy.

```ts
type ApprovalRecord = {
  actionId: string;
  workspaceId: string;
  actionType: ActionType;
  targetSummary: string;
  createdAt: string;
  status: "queued" | "approved" | "rejected" | "expired";
  sensitiveBodyStored: false;
};
```

## Client execution

The MCP queues. The app/extension executes only after visible approval.
