# First prompt to give Codex

You are working inside the `help-me-comms-mcp` repo.

Read these files first:

1. `CODEX_HANDOFF.md`
2. `README.md`
3. `docs/01-architecture.md`
4. `docs/02-trust-and-data-boundaries.md`
5. `docs/03-mcp-tool-surface.md`
6. `specs/tool-schemas.json`

Then do the following:

1. Make the TypeScript monorepo build.
2. Verify and fix MCP SDK imports and tool registration syntax.
3. Keep the MCP tool surface small: do not add platform-specific top-level tools.
4. Preserve the no-sensitive-data-retention boundary.
5. Implement the local mock demo first before adding real APIs.
6. Add tests for routing, evidence ranking, redaction, and approval queue.

Do not implement browser/IDE/computer control in the MCP. Return action plans only. Browser and VS Code extensions may perform user-approved local actions.
