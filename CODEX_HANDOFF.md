# Codex handoff: Help Me Comms MCP

## Mission

Build a production-ready, privacy-preserving community communications MCP and companion app/extension system for video game developers and modders.

The user asks conversational questions like:

- "I'm crashing at this stage, what do I do?"
- "Anyone else having these bottlenecks?"
- "What are players saying about the latest patch?"
- "Draft a reply to this thread."
- "Ask the community which idea they prefer."

The system should:

1. Read workspace/source context.
2. Scope the request against connected sources.
3. Retrieve only relevant evidence.
4. Answer conversationally or ask one useful follow-up.
5. Draft or queue actions with explicit approval.
6. Avoid storing sensitive data in the MCP.

## Non-negotiable boundaries

- Do not add mod-hosting metadata features to this repo.
- Do not add a giant platform-specific model-facing tool list.
- Do not let the MCP control the browser, IDE, terminal, or desktop.
- Do not persist sensitive message bodies, tokens, provider keys, logs, crash dumps, source files, or private thread content in MCP-owned storage.
- Do not auto-post, auto-delete, auto-ban, auto-publish, or auto-edit files without visible user approval.
- Do not send entire repositories, `.env` files, secrets, credential files, or unrelated folders to any AI provider.

## Desired architecture

```text
Web app / browser extension / VS Code extension / AI client
 ↓
User-selected AI provider or host model
 ↓
Help Me Comms MCP
 ↓
Programmatic source router
 ↓
Adapters: Discord, Reddit, Steam, forums, GitHub, YouTube, Twitch, Slack, Matrix, support tools
 ↓
Ephemeral evidence pack + answer/draft/action plan
```

## First implementation milestones

### M0: Make the scaffold build

- Verify TypeScript package versions.
- Fix any MCP SDK import paths.
- Add basic tests for router, evidence ranking, privacy redaction, and action queue.
- Ensure no sensitive fixture data is committed.

### M1: Local demo without external APIs

- Implement mock adapters with fixture-free synthetic data.
- Implement `community_help` against mock evidence.
- Add a web app demo page that shows answer, evidence, suggested actions, and approval queue.
- Add VS Code command that sends selected text to local `community_help`.
- Add browser extension command that sends visible selected text to local `community_help`.

### M2: Real read-only adapters

- Discord read-only bot adapter for approved channels and threads.
- Reddit read-only OAuth adapter for configured communities.
- Steam reviews/news adapter.
- Forum adapter with Discourse-compatible implementation.
- GitHub Discussions/issues/comments adapter.

### M3: Draft and approval workflows

- Implement draft actions.
- Implement local/client approval queue.
- Implement "insert draft" in browser extension, but never submit automatically.
- Implement "show diff/apply after approval" in VS Code extension.

### M4: Trust and retention hardening

- Add secret scanning tests.
- Add retention guards.
- Add audit metadata without sensitive bodies.
- Add source consent UI.
- Add provider selection UI.

## Main tool to implement

`community_help` is the flagship tool. Everything else supports it.

Inputs:

- workspace id
- conversation id
- user message
- project hint
- mode
- source policy
- time window

Outputs:

- detected intent
- answer
- confidence
- evidence summary
- sources used
- follow-up question if needed
- suggested actions
- safe action plan when applicable

## Acceptance criteria

A good v1 demo should handle these prompts:

1. "I'm crashing at the factory boss intro. What do I do?"
2. "Anyone else having CPU bottlenecks in the city after the patch?"
3. "What are the top support problems this week?"
4. "Draft a helpful Discord reply asking for logs and mod list."
5. "Turn these complaints into idea cards."
6. "Which connected sources did you use, and should I add more?"

Each answer must show source scope, confidence, and approval-safe next actions.
