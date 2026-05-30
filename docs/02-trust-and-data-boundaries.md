# Trust and data boundaries

## Guiding promise

The MCP is a scoped communication broker. It does not own the user's accounts, computer, browser, IDE, source code, or sensitive community data.

## Default retention policy

Default: **ephemeral**.

The MCP should retrieve the minimum evidence needed for a task, return an answer or action plan, and discard sensitive evidence.

## Sensitive data that must not be saved by MCP-owned storage

- API keys, OAuth tokens, refresh tokens, provider keys
- Private Discord/forum messages
- User DMs
- Crash dumps, full logs, stack traces containing paths or identifiers
- Source code files or repository snapshots
- Browser page snapshots
- Full comment histories outside the active task scope
- Private support tickets
- User emails or private contact details
- Secrets from `.env`, config, credential, or key files

## Allowed non-sensitive storage

- Workspace id
- Enabled source names
- Source capability flags
- Channel/forum identifiers when approved by the workspace owner
- User preferences
- Approval queue metadata
- Redacted audit event metadata
- Action status ids

## User-owned retention option

For teams that want historical search, support a user-owned index or storage layer. The MCP can query it, but the MCP should not own it.

Examples:

- Local encrypted SQLite/vector index
- Customer-managed database
- Customer cloud storage
- Source-native search only

## Action boundary

The MCP may produce:

- Answers
- Evidence packs
- Drafts
- Action plans
- Approval requests

The MCP must not directly perform local actions such as:

- Clicking buttons in the browser
- Editing code files
- Running terminal commands
- Reading arbitrary tabs
- Submitting public posts
- Deleting comments
- Banning users
- Publishing announcements

Those actions belong to app/extension layers and require visible user approval.

## Consent screens

Each source connection should show:

- What source is being connected
- What scopes are requested
- Which spaces/channels/forums are included
- Whether write actions are available
- Whether public posting requires approval
- How to revoke access
- Whether any user-owned retention is enabled

## Provider trust model

The user chooses the AI provider when using the app/extensions. The MCP should disclose what evidence will be sent to the selected provider and should minimize that evidence.

Provider keys should be stored client-side, in a team-owned vault, or in the host AI client. The MCP should not persist provider secrets.
