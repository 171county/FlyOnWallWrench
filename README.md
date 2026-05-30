# Help Me Comms MCP

A communication-focused MCP and app scaffold for video game developers, modders, community managers, and support teams.

The product goal is simple:

> Ask what the community is saying, help a player or modder troubleshoot, find whether others are seeing the same issue, draft a response, and queue safe actions for user approval.

This repo is designed as a **Codex handoff scaffold**, not a finished production service. It contains product specs, source boundaries, MCP tool contracts, app/extension shells, adapter interfaces, privacy rules, and implementation tickets.

## Core principles

1. **Comms only.** This repo does not own mod metadata, file hosting, dependency graphs, release files, or large game-suite platform data.
2. **Tiny model-facing tool surface.** The model should use a few high-level tools, not dozens of platform-specific APIs.
3. **Programmatic routing.** The server scopes the user's request against connected sources before retrieving evidence.
4. **Conversational help.** The main experience is `community_help`: answer, ask one useful follow-up, draft, or queue an action.
5. **User-selected AI provider.** The app/extensions can use the user's chosen provider. The MCP provides scoped context, evidence, drafts, and action plans.
6. **No sensitive data saved by the MCP.** Message bodies, tokens, API keys, crash dumps, source files, logs, and private thread content must be ephemeral unless the user explicitly configures a user-owned store outside the MCP.
7. **Local execution stays local.** Browser/IDE/computer actions are performed by user-approved app or extension layers, not by the MCP.
8. **Approval-first writes.** Public posts, replies, moderation actions, and code/workspace edits require explicit visible user approval.

## Repo layout

```text
apps/web/                    Web app shell: inbox, evidence, drafts, approvals, settings
extensions/browser/          Browser extension shell for visible-page context and draft insertion
extensions/vscode/           VS Code extension shell for logs, selected text, diffs, and dev workflows
packages/core/               Shared types, routing, privacy, evidence ranking, action-plan logic
packages/mcp-server/         MCP tool registration and transport skeleton
packages/adapters/           Source adapter interfaces and comms-source placeholders
configs/examples/            Workspace, provider, source, and action-policy examples
docs/                        Product, architecture, privacy, security, roadmap, and test docs
specs/                       JSON/YAML contracts for tools, actions, events, and source capabilities
scripts/                     Dev utilities and guard scripts
```

## MVP source stack

Comms-only sources for v1:

- Discord
- Reddit
- Steam reviews/news/discussions where supported
- Discourse or similar official forums
- GitHub Discussions, issues, and comments as conversation surfaces

Follow-on sources:

- YouTube comments and live chat
- Twitch chat and events
- Slack and Matrix for internal/community teams
- App store reviews for mobile games
- Social and helpdesk adapters where teams need them

## Start here for Codex

Read these files in order:

1. [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md)
2. [`docs/00-product-brief.md`](./docs/00-product-brief.md)
3. [`docs/01-architecture.md`](./docs/01-architecture.md)
4. [`docs/02-trust-and-data-boundaries.md`](./docs/02-trust-and-data-boundaries.md)
5. [`docs/03-mcp-tool-surface.md`](./docs/03-mcp-tool-surface.md)
6. [`specs/tool-schemas.json`](./specs/tool-schemas.json)

## Development notes

This scaffold assumes a TypeScript monorepo using pnpm workspaces. It is intentionally conservative: external APIs are adapter placeholders, public writes are queued, and storage defaults to non-sensitive configuration only.

```bash
pnpm install
pnpm -r build
pnpm -r test
```

The scaffold is not expected to pass all builds until Codex fills TODO sections and verifies package versions/import paths.
