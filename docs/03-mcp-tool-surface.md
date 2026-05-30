# MCP tool surface

The model-facing MCP tool surface must stay small. The source-specific complexity belongs behind the router and adapter layer.

## Tools

### `get_workspace_context`

Use this first. It returns connected sources, configured projects, source capabilities, write policies, and optional sources.

### `community_help`

The flagship conversational tool. It scopes the user request, retrieves evidence, and returns an answer, follow-up question, draft, or action plan.

### `get_comms_thread`

Fetch one exact thread/conversation when the user points at a specific thread or when an action needs local context.

### `draft_comms_action`

Create a reply, announcement, poll, FAQ, known-issue post, or triage card from evidence.

### `queue_comms_action`

Queue a safe action for user approval. Public writes must be queued by default.

### `suggest_more_sources`

After an answer, recommend optional sources that might improve confidence or coverage.

## Do not expose these as top-level model tools

Avoid a giant list like:

```text
discord_search
reddit_search
steam_get_reviews
forum_search
youtube_comments
github_discussions
browser_click
vscode_edit_file
terminal_run
```

Those create unnecessary model burden and unsafe execution paths.

## Recommended tool behavior

1. Read workspace context.
2. Classify intent.
3. Select minimum connected sources.
4. Retrieve scoped evidence.
5. Rank and dedupe.
6. Answer or ask one question.
7. Offer safe next actions.
8. Suggest optional sources only after the main answer.

## Tool result shape

Every tool should return:

- `status`
- `workspace_id`
- `intent` when applicable
- `confidence` when applicable
- `sources_used`
- `evidence_refs`
- `answer` or `draft`
- `suggested_actions`
- `privacy_notice` when sensitive evidence was intentionally excluded
