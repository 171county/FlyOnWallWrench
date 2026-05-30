# Use Help Me Comms RIGHT NOW (no terminal, no build)

You don't need to be a developer to run this. ~60 seconds:

## Load it in Chrome / Edge / Brave

1. Download or clone this repo to your computer.
2. Open your browser and go to **`chrome://extensions`**
   (Edge: `edge://extensions` · Brave: `brave://extensions`).
3. Flip on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the **`extensions/browser`** folder from this repo.
6. Pin the **Help Me** icon (puzzle-piece menu → pin it).

That's it. It's already built — no `npm`, no terminal.

## Use it

- Click the **Help Me** toolbar icon → **Open side panel**.
- The panel **docks to the side of any page** and stays put as you browse.
- Tabs across the top:
  - **Ask** — type *"anyone else crashing here?"*, pick which sources to send
    to, hit **Check who else** (read prevalence) or **Queue broadcast**
    (approval-gated — nothing posts on its own).
  - **Pulse** — one live room mixing all your sources together.
  - **Discord / Reddit / Steam / Forum** — each source's live feed. Hit
    **+ me too** on a message and it raises the prevalence back in Ask.

Right now it runs on a **built-in demo feed** so you can play with the whole
flow offline. Connect a real source (see below) and the same screens fill with
live community data.

## Make it real (Discord)

The Discord adapter is wired and waiting. To go live you provide a **bot token**
and the **channel IDs** you approve — see
[`docs/connect-discord.md`](./connect-discord.md). Until you do, it stays on the
safe demo feed.

## Heads up

- The side panel only reads what you paste/select or the approved sources you
  connect. **Nothing is ever posted, deleted, or DM'd automatically** — drafts
  wait for your approval.
- Works in the browser **and** in VS Code (load the `extensions/vscode` folder
  the same way from the Extensions view → "Install from VSIX/folder" during dev).
