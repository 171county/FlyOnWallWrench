# Event types

Events are useful for app UI and audit metadata. Event bodies should avoid sensitive content unless user-owned retention is explicitly enabled.

## Events

- `workspace.connected_source`
- `workspace.revoked_source`
- `help.requested`
- `help.answered`
- `evidence.retrieved`
- `evidence.discarded`
- `draft.created`
- `action.queued`
- `action.approved`
- `action.rejected`
- `privacy.redaction_applied`
- `provider.changed`
- `extension.page_context_requested`
- `extension.workspace_context_requested`

## Redacted event example

```json
{
  "event_type": "help.answered",
  "workspace_id": "team_123",
  "intent": "crash_support",
  "sources_used": ["discord", "steam_reviews"],
  "evidence_count": 8,
  "sensitive_body_stored": false,
  "created_at": "2026-05-27T12:00:00Z"
}
```
