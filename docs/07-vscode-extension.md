# VS Code extension design

## Purpose

The VS Code extension connects community communication evidence to developer/modder workflows.

## Capabilities

- Explain selected crash log.
- Search community reports for selected stack trace or error.
- Generate reproduction steps.
- Draft an issue from selected evidence.
- Draft patch notes from selected changes.
- Propose config/code diffs.
- Apply diffs only after approval.
- Run configured tasks only after approval.

## Data minimization

The extension should send the smallest useful snippet:

- Selected text, not whole files.
- Current log excerpt, not whole log directory.
- Workspace metadata, not source tree.
- Redacted paths/secrets.

Never send:

- `.env` files
- credential files
- private keys
- unrelated folders
- entire repositories by default

## AI provider handling

The extension should support:

- Host-provided model when available.
- User-selected provider in settings.
- Local or enterprise-compatible provider mode.

## Approval model

- Show diffs before applying.
- Show commands before running.
- Show target before creating an issue or reply.
- Do not edit or run tasks silently.
