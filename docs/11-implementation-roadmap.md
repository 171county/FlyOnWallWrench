# Implementation roadmap

## Phase 1: Scaffold to local demo

- Make monorepo build.
- Implement mock adapters.
- Implement `community_help` with synthetic evidence.
- Add answer, confidence, evidence, suggested action output.
- Add web app demo page.
- Add browser extension selected-text demo.
- Add VS Code selected-text demo.

## Phase 2: Real read-only source adapters

- Discord approved-channel read adapter.
- Reddit configured-community read adapter.
- Steam review/news read adapter.
- Discourse-compatible forum read adapter.
- GitHub Discussions/issues/comments read adapter.

## Phase 3: Conversation and routing quality

- Intent classifier.
- Source selection policies.
- Evidence dedupe and clustering.
- Confidence scoring.
- Session state.
- One-follow-up-question policy.

## Phase 4: Draft and approval workflow

- Draft reply/announcement/poll/FAQ/known-issue cards.
- Approval queue UI.
- Browser insert after approval.
- VS Code diff after approval.
- Source-specific prepare-action methods.

## Phase 5: Trust hardening

- Retention guard.
- Redaction guard.
- Secret scanning.
- Audit metadata only.
- Source revocation.
- Provider disclosure.
- User-owned storage integration.

## Phase 6: Expanded sources

- YouTube comments/live chat.
- Twitch chat/events.
- Slack/Matrix.
- App store reviews.
- Helpdesk and social adapters.
