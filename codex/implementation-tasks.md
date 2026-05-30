# Implementation tasks for Codex

## Task 1: Build health

- Install dependencies.
- Fix TypeScript config/package references.
- Verify MCP SDK imports.
- Add missing Vitest config if needed.
- Make `pnpm -r build` pass.
- Make `pnpm -r test` pass.

## Task 2: Local demo runtime

- Implement a local mock source registry.
- Wire `/api/community-help` to `communityHelp`.
- Add a small web form to submit a question.
- Render answer, confidence, sources used, evidence, and suggested actions.

## Task 3: Conversation behavior

- Add session tracking in memory for local demo.
- Store only non-sensitive session metadata.
- Add one-follow-up-question policy.
- Add response modes: `direct_answer`, `troubleshooting_steps`, `correlation_check`, `idea_cards`, `reply_draft`.

## Task 4: Approval queue

- Add in-memory approval queue for demo.
- Add actions list in the web app.
- Add approve/reject UI.
- Do not execute real public writes.

## Task 5: Browser extension demo

- Send selected text or visible page context to local app after user click.
- Show answer in side panel.
- Add "insert draft" only after explicit user action.
- Do not auto-submit forms.

## Task 6: VS Code extension demo

- Send selected text only by default.
- Show answer in output panel or webview.
- Add diff proposal command, but do not apply without approval.
- Add guardrails for `.env`, key files, and credential-like files.

## Task 7: Real read-only adapter path

Add adapters in this order:

1. Discord read-only approved channels/threads.
2. Steam reviews/news.
3. Reddit configured communities.
4. Discourse-compatible forums.
5. GitHub Discussions/issues/comments as conversation surfaces.

Each adapter must enforce source scopes and return normalized `EvidenceItem`/`ThreadContext`.

## Task 8: Trust hardening

- Add no-sensitive-fixture test to CI.
- Add structured redaction tests.
- Add audit metadata without message bodies.
- Add source revocation path.
- Add provider disclosure UI.
