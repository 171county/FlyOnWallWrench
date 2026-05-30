# Product brief

## Name

Help Me Comms MCP

## One-line description

A conversational, privacy-preserving community support and communications MCP for game developers, modders, and community teams.

## Job to be done

When a player, modder, developer, or community manager asks for help, the system should answer using the community's connected sources and produce safe next actions.

## Example prompts

- "I'm crashing at this stage, what do I do?"
- "Anyone else having these bottlenecks?"
- "Find related Discord, Reddit, Steam, and forum reports."
- "Draft a reply to this angry thread."
- "Turn this week's complaints into idea cards."
- "Ask the community which of these two fixes they prefer."

## User groups

### Player/modder support user

Needs practical troubleshooting steps, confidence, and one clear follow-up question when needed.

### Community manager

Needs summaries, drafts, known-issue posts, poll drafts, and approval-safe replies.

### Developer or technical modder

Needs issue correlation, repro details, crash-log context, and links from community reports to technical artifacts.

## Modes

1. **Answer user.** Conversational support response.
2. **Correlation check.** "Are others seeing this?"
3. **Sentiment summary.** "What is the community saying?"
4. **Idea extraction.** Convert chatter into ranked idea cards.
5. **Draft action.** Reply, announcement, poll, forum post, or internal digest.
6. **Triage.** Create a structured issue/repro draft.

## Success criteria

- The model sees a small MCP tool surface.
- The MCP scopes requests before retrieval.
- Answers cite or reference evidence objects.
- Public writes require approval.
- Sensitive data is not persisted by the MCP.
- The same runtime works from the web app, browser extension, VS Code extension, ChatGPT, Claude, and other MCP clients.
