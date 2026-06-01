# FOTW² — Strategy & Gameplan

> Status: **living draft** (v1). This is the north-star doc for product structure,
> licensing, distribution, and go-to-market across the wrench suite. It is a plan,
> not a promise — dates and tiers will move. Owner: Sean (171county).

---

## 1. What this actually is

Not "an extension." A **suite with one cockpit**:

| Layer | What | Ships as |
|---|---|---|
| **The wrenches** | ModWrench, DefWrench, MyneWrench — headless MCP servers | npm + MCP registries (install into Claude/Cursor/ChatGPT) |
| **FOTW² (the face)** | Browser side panel + VS Code panel — the only piece with pixels | Chrome Web Store / VS Code Marketplace |
| **The Rack + spine** | The glue that makes the headless wrenches visible *and* threads one story across them | The moat — bundled into FOTW², gated as Pro |

Three of the four wrenches are invisible (MCP servers live inside an AI client).
**FOTW² is the cockpit glass for all of them.** The Rack is the pegboard; the
**correlation spine** is the connective tissue: community signal → mod cause →
dev fix → creator impact, as **one thread, not six screens.**

**The one-line pitch:** *Stop alt-tabbing across six windows. FOTW² is the cockpit
that unites your modding/dev wrenches and the community around your game — read the
room, thread the cause, draft the fix, from wherever you already work.*

---

## 2. The moat (what's actually defensible)

- **Not** the adapters (anyone can call the Discord API).
- **Not** the chat UI (pretty, but copyable).
- **The cross-wrench correlation spine** — threading a single narrative across
  Mod/Def/Myne/community. Nobody in this space connects "what players say" to
  "what mod broke" to "what ticket fixes it." That's the thing worth charging for,
  and it happens to be exactly the day-one vision ("what the wrenches become
  together").

Everything else is the funnel; the spine is the business.

---

## 3. Licensing: open-core (decided)

**Anchor decision:** open-core. Permissive base, protected spine.

| Bucket | License | Contents |
|---|---|---|
| **Core (free, forkable)** | MIT / Apache-2.0 | FOTW² chat + Ask, the source-adapter pattern, 2–3 source adapters (Discord/Reddit/GitHub), draft+paste, the `WrenchBridge` **contract**, single-wrench use |
| **Pro (protected)** | source-available (BSL 1.1 or closed pkg) | The **correlation spine**, the **Rack cross-wrench threading**, premium adapters, persistence/sync, tone picker |
| **Studio/Team** | commercial | Shared inbox, multi-seat, team web app, admin/approval policy, support/SLA |

### Package boundary (do this on the spine's FIRST commit)
Re-licensing public code later is legally messy (contributors, git history). Set
the boundary up front:

```
packages/core        MIT      types, router, adapters pattern, draft composer
packages/adapters    MIT      mock + read adapters, WrenchBridge mocks
packages/pro         BSL/closed   correlate.ts (spine), premium bridges, license gate
extensions/*         MIT shell + Pro features gated by a license-key check
```

The Free build is **fully functional** — gating adds the *connective* magic, it
never cripples the base.

> ⚠️ **Lawyer gate:** BSL vs SSPL vs closed-Pro is a real legal call. This doc
> *recommends* BSL 1.1 (look/fork the source, can't resell, converts to Apache
> after N years). Before publicly relicensing anything: ~20 min with an IP
> attorney. Do not skip this.

---

## 4. Tiers (selectability IS the tiering)

The "selectable wrenches / selectable sources" UI we already built **is** the
tier mechanism. We gate what's selectable behind a license-key check — we don't
hide code.

| Tier | Price (placeholder) | Who | Unlocks |
|---|---|---|---|
| **Free / OSS** | $0 | everyone, forkers | chat + Ask, 2–3 sources, draft+paste, **one** paired wrench |
| **Pro** | ~$5–9/mo | serious modders/devs | all sources, **Rack + cross-wrench spine**, unlimited wrenches, persistence/sync, tone picker |
| **Studio/Team** | seat-based | studios, platforms | shared inbox, multi-seat, team web app, admin, support |

Pricing is a guess — validate against what modders (low) vs creators (higher) vs
studios (highest) will actually pay. **Don't force one price across audiences.**

---

## 5. Distribution: two doors

### Door A — forkers (GitHub crowd) → reach & credibility, NOT revenue
- Clean public repo, `CONTRIBUTING.md`, the `WrenchBridge` contract documented as
  a **public API** so people build their own wrench bridges.
- This crowd extends and evangelizes the suite. Treat them as R&D + distribution,
  never as the buyer.

### Door B — non-GitHub humans (the actual market) → never see a terminal
- **Chrome Web Store** listing — one-click install (≈90% there).
- **VS Code Marketplace** listing — VSIX is built.
- **Wrenches need a double-click installer**, not `npm`/`.env`. **This is the #1
  blocker to "downloadable app."** (See §7, the local bridge.)

---

## 6. Where the wrenches go (strategy)

**Chosen road: wrenches as the free funnel → FOTW² Pro as the business.**
The wrenches are great free MCP servers that drive adoption; the Rack/spine that
unites them is the paid layer.

**Caveat that matters:** **MyneWrench is effectively a different company** than
Mod/Def. Creator-economy users (Roblox/UEFN, real payouts) *pay*; hobbyist Skyrim
modders mostly don't. Keep one umbrella brand, but expect **Myne to produce
revenue first** and price it for its audience, not the modders'.

---

## 7. What we're missing (honest gap list, blocker-ordered)

1. **Local bridge / installer** — wrenches are headless MCP servers; the extension
   can't reach them without a small local helper. For normal users this must be a
   **double-click installer** that sets up wrenches + bridge + writes MCP config.
   **#1 blocker to "downloadable app."**
2. **License service** — tiny service to issue + validate license keys. (Not a SaaS;
   a key check.)
3. **Landing page** — store listings need a home: what it is, 30-sec demo video,
   "Install for Chrome / VS Code / Claude." (Not the team web app — a marketing site.)
4. **Trust & ToS** — public privacy policy + "we store nothing" (it's true, and it
   sells). Chrome Web Store **will** scrutinize host permissions — prepare the
   justification.
5. **Real wrench bridges** — mock → live (the recurring "local helper" work).
6. **Name + mark** — lock "FOTW² / Fly On The Wall"; trademark-search before
   marketing spend.

---

## 8. Build order (decided: gameplan → spine → one-click)

1. **Gameplan** — this doc. ✅ (keep it living)
   - ✅ **DONE:** license boundary set — spine moved to `packages/pro` (BUSL-1.1); contract stays in `@help-me-comms/core` (MIT).
   - ✅ **DONE:** live MCP bridge built (`@fotw/pro` `McpWrenchBridge`) — talks to a localhost wrench endpoint; mock fallback when absent.
2. **(1.5) License boundary** — create the `core`(MIT) vs `pro`(BSL/closed) package
   split *before* writing the spine into it. Cheap now, painful later.
3. **Spine (live)** — build real wrench bridges (mock → live via the local helper),
   prove the cross-wrench thread on actual Mod/Def data, **inside `packages/pro`.**
4. **One-click** — installer wrapping wrenches + bridge + FOTW², plus the
   license-key gate. Unblocks the Free-tier store launch for non-GitHub humans.
   - ✅ **DONE:** the **local helper** (`@fotw/helper`) — loopback bridge the Rack
     uses to reach local wrenches (token-gated, read-only, holds no secrets);
     Settings → Local helper wires it; live spine flips to real data. Cross-
     platform install scripts in `installer/`; see `docs/INSTALL.md`.
   - ⏳ **NEXT:** signed double-click installer (.exe/.dmg, bundles Node + auto-
     start) — needs code-signing + build runners. License-key gate still to do.

Rationale: **decide → prove → package.** Each step depends on the prior. Don't
package a thing you haven't proven; don't prove a thing in the wrong-licensed file.

---

## 9. Go-to-market sequence (traction first, platforms later)

**Reach the makers before the platforms.**

1. **Modders & indie devs first** — drop ModWrench/FOTW² Free in r/skyrimmods,
   Thunderstore Discords, indie gamedev communities. Goal: 100 people saying
   "holy shit this is useful." That's leverage for everything after.
2. **Platforms (mod.io / Thunderstore / Modrinth)** — reach out **with traction,
   not before.** The ask is **API access / partnership / "works with" badge**, not
   money. mod.io is API-friendly and wants ecosystem tooling — but "500 modders use
   ModWrench on your platform" gets the meeting; zero users gets ignored.
   - **Nexus = handle with care.** Famously protective of their API; read terms
     before leaning on them publicly.
3. **Studios** — the Studio-tier sales motion: later, warmer, higher-touch. Start
   with indie/mid studios living the 6-tab problem DefWrench targets.
4. **Creators (Myne)** — separate motion, separate (higher) price, likely the first
   real revenue.

---

## 10. Trust posture (a feature, say it loud)

Carried from the wrench DNA, true across the suite:
- **No secrets held.** API keys in the OS keychain / the user's own session. The
  extension holds nothing.
- **Read-only by default.** Writes are approval-gated drafts you paste yourself —
  works on every platform, including those with no posting API (Steam).
- **Ephemeral evidence.** Community content is untrusted, scoped, discarded.
- **Nothing posts automatically.** Ever.

This isn't just ethics — it's the differentiator vs. "claw" tools, and the answer
to Chrome's permission review.

---

## 11. Open questions (decide as we go)

- BSL vs closed-Pro for `packages/pro` (lawyer gate).
- Pricing per audience (modder / creator / studio).
- License-key service: build tiny vs. use a vendor (e.g. an off-the-shelf
  licensing API) to avoid running infra.
- Installer tech (Tauri? platform installers? signed binaries — code-signing cost).
- One brand vs. sub-brands (FOTW² umbrella; Myne possibly its own face).

---

*Living doc. Update as decisions land. The plan is deliberately ahead of the
code — that's the point.*
