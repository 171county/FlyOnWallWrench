# Browser extension design

## Purpose

The browser extension lets users bring Help Me Comms into the pages where game communities already communicate.

## Supported surfaces

- Discord web
- Reddit
- Steam community pages
- Forums
- GitHub
- YouTube comments
- Twitch dashboard or chat pages
- Support tools where allowed

## Capabilities

- Send selected text to Help Me.
- Summarize visible thread/page context after user action.
- Find related reports.
- Draft replies into visible text boxes.
- Create known-issue/FAQ/idea drafts.
- Queue action cards for web app approval.

## Permission model

Use narrow permissions:

- Prefer active-tab or user-initiated page access.
- Avoid broad host permissions by default.
- Do not read every tab.
- Do not background-scrape private pages.
- Do not auto-submit forms.

## Execution boundary

The MCP returns an `ActionPlan`. The extension decides whether it can safely execute client-side steps.

Examples:

- Fill text box: allowed after user clicks insert.
- Submit post: requires explicit confirmation.
- Delete/moderate: disabled by default.
- Read private messages: disabled by default.

## UI actions

- "Ask Help Me about this page"
- "Summarize thread"
- "Draft reply"
- "Find related reports"
- "Turn into known issue"
- "Turn into idea card"
- "Queue action"
