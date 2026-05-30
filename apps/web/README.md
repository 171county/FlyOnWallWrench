# @help-me-comms/web — optional team host

This Next.js app is **not** the daily driver. For a single developer or modder,
the **browser side panel** and the **VS Code panel** are the primary surfaces —
they run the Help Me brain in-extension (no server), so there are no extra tabs
to keep open.

Run this app only when a studio/team wants a **shared, multi-seat hub**:

- a common inbox, evidence viewer, drafts/approval queue, and idea board
- a hosted `/api/community-help` endpoint for clients that prefer a server
- a place to manage team-wide source connections and provider settings

```bash
pnpm --filter @help-me-comms/web dev    # http://localhost:3000
```

Personal use needs none of this — load the browser extension or the VS Code
extension and the side panels work on their own.
