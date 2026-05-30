# Threat model

## Assets to protect

- Source account credentials
- AI provider keys
- Private community messages
- Crash logs and stack traces
- Source code and workspace files
- Browser page context
- User identities and private contact data
- Public posting authority
- Moderation authority

## Threats

### Overbroad retrieval

The system retrieves more than needed and sends it to a provider.

Mitigation: source scoping, selected-text defaults, redaction, evidence budget limits.

### Unapproved public action

The model or integration posts, deletes, bans, publishes, or edits without approval.

Mitigation: action queue, approval policy, client-side confirmation, disabled moderation by default.

### Credential leakage

Tokens or provider keys are stored in MCP-owned databases or logs.

Mitigation: no credential persistence, short-lived tokens, customer-owned vaults, log scrubber.

### Extension overreach

Browser or IDE extension reads tabs/files/workspaces outside the user's intent.

Mitigation: active-tab/user-initiated access, selected-text-first, workspace consent, no broad background scraping.

### Prompt injection from community content

A malicious user posts instructions that try to control the assistant or exfiltrate data.

Mitigation: treat community content as untrusted evidence, quote/summarize safely, never let evidence override system/tool policy.

### Data retention drift

Implementation starts saving sensitive evidence for convenience.

Mitigation: retention tests, schema guardrails, code review checklist, explicit user-owned storage only.

## Default deny list for MCP actions

- Browser click/submit actions
- File edit actions
- Terminal commands
- Public post/publish actions
- Moderation actions
- DM actions

These can only be represented as drafts/action plans for approval by a client layer.
