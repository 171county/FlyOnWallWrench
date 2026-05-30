# Help Me Comms — VS Code

Ask the community brain about a selected crash log, error, or code/config
snippet — right inside your editor. Part of the FlyOnWallWrench community
intelligence suite for game developers and modders.

## What it does

Select some text (a stack trace, an error line, a config block), run a Help Me
command, and a styled panel opens beside your code with:

- a conversational **answer** and detected intent
- scoped **community evidence** and a confidence read
- an editable, copy-ready **draft** in the right community voice

The brain runs **in the extension host** — there is no server to start. It sends
**selected text only**; it never reads whole files, runs commands, edits your
workspace, or posts anything. Drafts are yours to copy where you want them.

## Commands

- **Help Me: Ask About Selection** — general conversational help on the selection
- **Help Me: Explain Crash Log** — triage a selected crash log / stack trace
- **Help Me: Create Issue Draft** — turn the selection into a known-issue draft

Open the Command Palette (Ctrl/Cmd+Shift+P) and type "Help Me".

## Privacy

- Selected text only — no whole-file or workspace reads.
- No automatic posting, editing, or command execution.
- No tokens or message bodies are persisted by the extension.

## Part of FlyOnWallWrench

The same community brain powers a browser side panel and an MCP server, so you
can use Help Me wherever you already work.
