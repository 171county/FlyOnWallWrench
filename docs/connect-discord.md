# Connect Discord (live, read-only)

This turns the demo feed into **real messages from the channels you approve** —
read-only. Nothing is ever posted; drafts always wait for your approval.

You don't need to code. ~5 minutes.

## 1. Make a bot (one time)

1. Go to **https://discord.com/developers/applications** → **New Application**,
   name it (e.g. "Help Me Comms").
2. Left sidebar → **Bot** → **Add Bot**.
3. Under **Privileged Gateway Intents**, turn on **Message Content Intent**
   (required to read message text).
4. Click **Reset Token** → **Copy**. This is your `HELP_ME_DISCORD_BOT_TOKEN`.
   Keep it private — treat it like a password.

## 2. Invite the bot to your server

1. Left sidebar → **OAuth2** → **URL Generator**.
2. Scopes: check **bot**.
3. Bot Permissions: check **View Channels** and **Read Message History** (that's
   all it needs — no send, no manage).
4. Copy the generated URL, open it, and add the bot to your server.

## 3. Get the channel IDs you want it to read

1. In Discord: **User Settings → Advanced → Developer Mode** = on.
2. Right-click a channel (e.g. `#bug-reports`) → **Copy Channel ID**.
3. Repeat for each channel you approve. These are your
   `HELP_ME_DISCORD_CHANNEL_IDS` (comma-separated).

## 4. Drop the values in

Create a `.env` file (copy `.env.example`) and fill in:

```bash
HELP_ME_DISCORD_BOT_TOKEN=your-bot-token
HELP_ME_DISCORD_CHANNEL_IDS=123456789012345678,987654321098765432
```

That's it. The **MCP server** and the **team web app** now read those channels
live. With no values set, everything stays on the safe mock feed.

## What it does / doesn't do

- ✅ Reads **only** the channel IDs you list.
- ✅ Message bodies are treated as untrusted, ephemeral evidence (redaction-flagged).
- ❌ Never sends, edits, deletes, or DMs. Write is disabled at the adapter level.
- ❌ The token is **never stored** by the MCP — it's read at runtime from your env.

## Note on the browser extension

The side-panel extension intentionally uses the **mock feed**, because a browser
bundle is not a safe place for a bot token. To see live Discord in a UI, run the
**team web app** (`pnpm --filter @help-me-comms/web dev`) with your `.env`, or
use it through an MCP client (ChatGPT/Claude/Cursor) pointed at the MCP server.
