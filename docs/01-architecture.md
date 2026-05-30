# Architecture

## System overview

```text
User surface
  Web app | Browser extension | VS Code extension | AI client
      ↓
User-selected AI provider or host-provided model
      ↓
Help Me Comms MCP
      ↓
Conversation runtime
      ↓
Intent router + source scoping
      ↓
Source adapters
      ↓
Ephemeral evidence pack
      ↓
Answer, draft, action plan, or queued approval
```

## Components

### Web app

The web app is the command center:

- Help inbox
- Source connections
- Provider settings
- Evidence viewer
- Known issues
- Idea board
- Drafts and approval queue
- Privacy and permission settings

### Browser extension

The browser extension works with visible page context and user approval:

- Summarize current thread/page
- Draft a reply into a text box
- Find related reports
- Send selected text to Help Me
- Queue a safe action

The extension may fill a draft, but it must not submit public posts without explicit user approval.

### VS Code extension

The VS Code extension supports developer/modder workflows:

- Explain selected crash logs
- Search community reports for a stack trace
- Generate repro steps
- Draft issue or patch note
- Propose diffs
- Apply edits only after approval
- Run configured tasks only after approval

### MCP server

The MCP server provides high-level tools:

- `get_workspace_context`
- `community_help`
- `get_comms_thread`
- `draft_comms_action`
- `queue_comms_action`
- `suggest_more_sources`

### Source adapters

Adapters are programmatic connectors hidden behind the tool surface:

- Discord
- Reddit
- Steam reviews/news/discussions where supported
- Discourse-compatible forums
- GitHub Discussions/issues/comments
- YouTube comments/live chat
- Twitch chat/events
- Slack/Matrix
- App store reviews
- Social/helpdesk adapters

## Data flow

1. User asks a question.
2. Runtime reads workspace context.
3. Router classifies intent and selects minimum connected sources.
4. Adapters retrieve scoped evidence.
5. Evidence is normalized, ranked, deduped, and redacted.
6. Answer engine returns a conversational response.
7. Draft/action engine creates approval-safe actions when needed.
8. Sensitive evidence is discarded unless the user has configured user-owned retention.

## Storage boundary

MCP-owned storage may hold:

- Workspace id
- Source names and capabilities
- Non-sensitive settings
- Approval status metadata
- Redacted audit records

MCP-owned storage must not hold:

- Source credentials or provider API keys
- Private message bodies
- Crash dumps or logs
- Source files
- Unredacted action content after task completion
- Browser page snapshots
- IDE workspace contents

## Deployment shapes

### Local-first

The MCP runs locally. Extensions call localhost. Provider keys remain client-side.

### Team cloud

The MCP runs as a remote service. Credentials are held in a customer-owned vault or short-lived OAuth grants. Sensitive data remains ephemeral.

### AI-client native

ChatGPT, Claude, VS Code, or another MCP-compatible host invokes the MCP directly. The MCP exposes only approved high-level tools.
