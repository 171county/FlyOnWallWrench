# Test plan

## Unit tests

- Intent classification.
- Source scoping.
- Evidence ranking.
- Evidence dedupe.
- Privacy redaction.
- Action queue policy.
- Provider envelope minimization.

## Integration tests

- `community_help` with mock adapters.
- Exact thread retrieval.
- Draft generation from evidence.
- Queue action and approval status.
- Browser extension selected-text to local app.
- VS Code selected-text to local app.

## Security tests

- No sensitive fixtures committed.
- Redaction catches common key/token patterns.
- `.env` and secret files are ignored.
- Public writes are queued by default.
- DMs/private spaces disabled by default.
- MCP never emits browser-click or file-edit commands.

## Acceptance prompts

1. "I'm crashing at the factory boss intro. What do I do?"
2. "Anyone else having CPU bottlenecks in the city after the patch?"
3. "Summarize top support problems this week."
4. "Draft a reply that asks for logs and mod list."
5. "Create idea cards from this feedback."
6. "Which sources did you use and what should I connect next?"
