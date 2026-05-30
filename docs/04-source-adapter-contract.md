# Source adapter contract

Adapters are hidden behind the programmatic router. They must implement a common interface so the MCP can search and retrieve conversations consistently.

## Adapter responsibilities

- Declare capabilities.
- Enforce source-specific permissions.
- Retrieve scoped messages/threads/reviews/comments.
- Normalize results into `CommsItem` and `ThreadContext`.
- Redact sensitive data before returning evidence.
- Never store source credentials in adapter-owned files.
- Never write publicly unless called through an approval-safe action path.

## Core adapter methods

```ts
interface CommsSourceAdapter {
  kind: SourceKind;
  capabilities: SourceCapabilities;
  search(request: SourceSearchRequest, context: WorkspaceContext): Promise<EvidenceItem[]>;
  getThread(ref: SourceRef, context: WorkspaceContext): Promise<ThreadContext>;
  prepareAction?(request: DraftActionRequest, context: WorkspaceContext): Promise<ActionPlan>;
}
```

## Capability flags

```ts
type SourceCapabilities = {
  read: boolean;
  write: "disabled" | "draft_only" | "approval_required" | "enabled";
  supportsThreads: boolean;
  supportsSearch: boolean;
  supportsRealtime: boolean;
  supportsPrivateSpaces: boolean;
  supportsUserOwnedRetention: boolean;
};
```

## Comms sources

### Discord

Use approved server/channel/thread/forum scopes. Message content access and bot permissions must be explicit.

### Reddit

Use approved API access and configured communities. Public posting must require approval.

### Steam

Start with reviews and news. Discussions can be added where supported and compliant.

### Forums

Start with Discourse-compatible forums, then add generic forum providers if customers require them.

### GitHub

Treat Discussions, issues, release threads, PR comments, and issue comments as communication surfaces. Do not turn this repo into a full dev-suite integration.

### YouTube and Twitch

Use for creator reactions, update videos, dev streams, and live event feedback.

### Slack and Matrix

Use for internal routing, team digests, and private contributor communities with explicit opt-in.

## Source-specific write actions

All write actions must be represented as drafts or queued approval actions unless a workspace explicitly enables direct action.
