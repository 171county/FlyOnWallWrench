# Install FOTW² + the local helper

Two halves: the **extension** (the face) and the **helper** (connects the Rack to
your local wrenches). The extension works on its own with demo data — the helper
is only needed to make the Rack thread your **real** ModWrench/DefWrench/MyneWrench.

## 1. The extension (no terminal)

- **Browser:** `chrome://extensions` → Developer mode → **Load unpacked** →
  `extensions/browser`. (Pre-built; ships ready.)
- **VS Code:** Extensions → **Install from VSIX** → `extensions/vscode/help-me-comms.vsix`.

That alone gives you the full cockpit on the **demo feed** — Ask, Pulse, source
feeds, Queue, the Rack with mock wrench data. Offline, no setup.

## 2. The local helper (to go live with your wrenches)

The helper is a tiny **loopback-only** server (binds `127.0.0.1`, requires a
token, read-only, holds no secrets). It lets the Rack reach your local MCP
wrenches.

**macOS / Linux:**
```bash
./installer/install.sh
```
**Windows (PowerShell):**
```powershell
./installer/install.ps1
```
**Or, if already built:**
```bash
node installer/start-helper.mjs
```

It prints something like:
```
FOTW² helper listening on http://127.0.0.1:7717
token: ab12cd34ef56
```

## 3. Connect them

In the extension: **Settings (⚙) → Local helper** → paste the URL
(`http://127.0.0.1:7717`) and the **token** → **Save helper**. Chrome will ask to
allow the loopback connection (one-time). Open the **Rack**, type a topic, hit
**Thread it** — the card now reads **● Live**, threaded from your wrenches.

With no helper configured, the Rack quietly uses demo data. Nothing breaks.

## What the helper does / doesn't

- ✅ Loopback only (`127.0.0.1`), per-run token, CORS limited to the extension.
- ✅ Read-only: relays "findings"-style read tools; never writes.
- ✅ Holds no secrets — real wrench credentials live in each wrench's own config /
  the OS keychain, exactly as the wrenches already do.
- ❌ Not exposed to the network; not a server you host.

## Wiring real wrenches (advanced, optional)

By default the helper serves **mock** findings for `mod`/`def`/`myne` so you can
see the live path with zero setup. To point a wrench at its real MCP server, set
its registry entry to `mode: "mcp"` with the launch `command`/`args` and a
read-only `queryTool` (see `packages/helper/src/wrenchRegistry.ts`). The helper
spawns it over stdio and relays one read-only tool call per topic.

## Still ahead (honest)

- A **signed, double-click installer** (`.exe`/`.dmg`) that bundles Node + the
  helper + auto-starts it on login — so non-technical users skip the scripts
  entirely. That needs code-signing certs and platform build runners (a
  packaging step, tracked in `docs/STRATEGY.md` §7/§8).
- Real wrench `mcp`-mode configs for ModWrench/DefWrench/MyneWrench.
