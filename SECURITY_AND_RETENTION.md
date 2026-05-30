# Security and retention summary

Default behavior: the MCP does not store sensitive data.

## Never persist in MCP-owned storage

- Source credentials
- Provider keys
- Private message bodies
- Direct messages
- Crash dumps
- Full logs
- Source files
- Browser page snapshots
- IDE workspace contents
- Private support tickets

## Local/client execution

Browser and IDE actions are client-side and approval-first. The MCP may produce action plans, but it does not control pages, run commands, edit files, or submit public posts.

## Public actions

Public replies, announcements, posts, moderation actions, and publishing operations are queued for user approval by default.

## User-owned retention

If historical search is needed, use a user-owned retention layer. The MCP can query it under consent, but should not own sensitive content.
