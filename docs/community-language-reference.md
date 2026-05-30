# Game & Mod Community Communication Patterns — Synthetic Vocabulary Reference

Reference for enriching the demo feed (`extensions/browser/src/feed.ts`), draft
templates, and future real adapters (M2). All examples are **synthetic and
paraphrased** — invented handles, no real users or copied text. Phrasing mirrors
authentic conventions across Discord, Reddit, Steam, Nexus/Discourse forums, and
GitHub.

## Per-platform register (tone)

- **Discord** — fastest, most casual. Lowercase, no punctuation, emoji, @pings,
  "lol/lmk/nvm". Logs as attachments. Mods enforce threads/megathreads. Best for
  real-time "anyone else right now?" correlation.
- **Reddit** — bimodal. Titles punchy/PSA-flavored ("PSA:", "[Bug]", "Is anyone
  else…"); bodies detailed with specs + load order. Strong self-solve culture
  ("EDIT: SOLVED"). Upvotes surface prevalence.
- **Steam** — bluntest, most emotional. Reviews verdict-first, hyperbolic,
  refund-threatening ("unplayable", "stutter city", "wait for a sale").
  Discussion boards terse with [SOLVED] tags. Devs/CMs reply formally, sparingly.
- **Forums (Nexus/Discourse/official)** — most structured, polite,
  version-stamped. Templated reports, attached logs, quoting, [SOLVED] markers,
  stickies. Mod authors + moderators authoritative.
- **GitHub** — most formal/technical. Markdown templates, code blocks,
  gist-linked logs. Maintainers communicate via labels + short triage replies.

## Glossary

| Term | Meaning |
|---|---|
| CTD | Crash To Desktop |
| Hard crash | Total freeze/crash, often no error |
| Soft lock | Game runs but progress impossible |
| Repro / repro steps | Reproduction steps |
| Load order | Sequence mods/plugins load in |
| Vanilla | Unmodded stock game |
| Conflict | Two mods editing the same records |
| Compatibility patch | Mod making two conflicting mods coexist |
| Missing master | Required parent plugin absent |
| LOOT | Load Order Optimisation Tool |
| xEdit / SSEEdit | Plugin record inspector/editor |
| Script extender (SKSE/F4SE) | Dependency tool; version must match game |
| Mod loader | Injects mods (Forge, BepInEx, MelonLoader) |
| Mod manager (MO2/Vortex) | Installs/orders mods |
| Crash log / Papyrus log | Diagnostic file at/after crash |
| Hotfix | Small urgent patch |
| Verify files | Launcher re-downloads corrupted files |
| Clean install | Full remove + reinstall |
| DDU | Display Driver Uninstaller |
| Stutter / micro-stutter | Brief frame hitches |
| Shader comp stutter | Hitching while building shaders |
| CPU/GPU bottleneck | One component limiting performance |
| Bricked | Broken beyond use |
| Known issue | Officially acknowledged bug |
| Triage | Sorting/labeling reports |
| Endorse (Nexus) | Mod upvote-equivalent |
| Rollback | Revert to a prior version |

## Dev / moderator response conventions

**Acknowledge / pin:** "📌 KNOWN ISSUE: [bug] after the latest patch. We're aware,
fix in progress — please don't open new reports." · "We can reproduce internally.
Hotfix targeted for [timeframe]."

**Request info / repro:** "Can you share your full load order and the complete
crash log?" · "Does this happen on a clean/vanilla profile, or only with mods?" ·
"Have you verified game files and updated [script extender]?"

**Triage / housekeeping:** labels `needs-repro`, `needs-info`, `bug`, `crash`,
`duplicate`, `wontfix`, `confirmed`. · "Closing as duplicate of #123." · "Marking
needs-repro — can't act without reliable steps." · "Merging into the existing
megathread."

**Mod author:** "Known issue in v2.3, fixed next release. Roll back or use the
workaround in the sticky." · "Conflict with [Other Mod] — grab the compat patch."

## Role tagging for feed variety

`player` (casual, frustrated) · `modder` (helpful, diagnostic, tool-fluent) ·
`creator`/mod-author (authoritative on their own mod) · `moderator` (housekeeping,
redirects, pins) · `developer`/CM (acknowledgment, hotfix promises, repro
requests).

---
*Synthesized by a research agent from public community conventions; all example
lines are invented for synthetic demo content.*
