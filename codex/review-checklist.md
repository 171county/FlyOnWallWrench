# Review checklist

Before merging implementation work, check:

## Product scope

- [ ] No mod-platform metadata features were added.
- [ ] The MCP still has a small high-level tool surface.
- [ ] Source-specific APIs stay behind adapters.
- [ ] `community_help` remains the flagship conversational tool.

## Data and privacy

- [ ] MCP-owned storage does not persist sensitive content.
- [ ] Source credentials are not saved in the repo or MCP database.
- [ ] Provider keys are not persisted by the MCP.
- [ ] Logs do not include private message bodies or secrets.
- [ ] Evidence is scoped, redacted, and discarded by default.

## Actions

- [ ] Public posting requires approval.
- [ ] Moderation actions are disabled by default.
- [ ] Browser extension does not auto-submit.
- [ ] VS Code extension does not edit/run commands silently.
- [ ] MCP returns action plans, not local-control commands.

## Quality

- [ ] Router tests cover crash/performance/ideas/reply intents.
- [ ] Evidence ranking tests cover recency, confirmations, duplicates.
- [ ] Redaction tests cover tokens, keys, `.env`, and credential paths.
- [ ] Mock demo handles acceptance prompts from `CODEX_HANDOFF.md`.
