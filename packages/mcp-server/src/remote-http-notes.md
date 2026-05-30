# Remote HTTP transport notes

This package starts with stdio transport for local development. For ChatGPT and remote MCP clients, add a remote HTTPS `/mcp` endpoint after verifying the current MCP SDK transport APIs.

Requirements for remote deployment:

- HTTPS endpoint.
- OAuth or session authorization if user-specific data is accessed.
- Per-user workspace scoping.
- No sensitive request/response logging.
- Approval flow for public writes.
- MCP metadata refresh after tool description changes.
