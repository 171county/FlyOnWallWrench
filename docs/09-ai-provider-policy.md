# AI provider policy

## Principle

The user or workspace chooses the AI provider. The MCP should not require one hardcoded provider.

## Provider modes

### Host-provided model

When the user is in an AI client, the host model calls the MCP tools.

### Bring-your-own provider

The web app/extensions use the user's configured provider and model.

### Local provider

The user runs a local model or enterprise endpoint. The app sends scoped evidence to that local endpoint.

## Provider key storage

Provider keys should not be persisted by the MCP. Acceptable patterns:

- Client-side storage controlled by the app/extension.
- Team-owned vault.
- Host AI client handles authentication.
- Short-lived session token.

## Evidence sending rules

Before sending evidence to any provider:

1. Scope to user request.
2. Redact secrets and identifiers where possible.
3. Exclude unsupported private spaces.
4. Avoid full logs/repos/pages.
5. Disclose source usage in the answer.

## Provider abstraction

The core package exposes an `AIProvider` interface. Implementers can add OpenAI, Anthropic, Google, local, or enterprise-compatible providers without changing MCP tool contracts.
