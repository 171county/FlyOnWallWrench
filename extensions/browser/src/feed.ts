// Synthetic live-feed content for the local demo. Phrasing mirrors authentic
// community conventions (CTD, repro, load order, verify files, "anyone else",
// known-issue, hotfix) per platform register — Discord casual/lowercase, Steam
// blunt, Reddit PSA-style, forums structured. All handles invented, no real
// users or copied text. Real read-only adapters (M2) will replace this.
export type FeedMsg = {
  author: string;
  role: "player" | "modder" | "developer" | "moderator" | "creator";
  body: string;
  ago: string;
  sentiment: "pos" | "neu" | "neg" | "mixed";
  up: number;
};

const BASE: Record<string, FeedMsg[]> = {
  // Discord — fast, lowercase, fragmented, pings, emoji, logs as attachments
  discord: [
    { author: "ctd_andy", role: "player", body: "@here anyone else CTD right at the factory boss intro after 1.4.2? clean install", ago: "just now", sentiment: "neg", up: 6 },
    { author: "modmancer", role: "modder", body: "drop the HD texture pack — fixed the boss-intro crash for me. updated my modlist.txt too", ago: "3m", sentiment: "pos", up: 12 },
    { author: "papyrus_pat", role: "player", body: "verified files, reinstalled, still ctd. mods: 14. anyone got a clean repro? 💀", ago: "11m", sentiment: "neg", up: 4 },
    { author: "Aria", role: "moderator", body: "📌 KNOWN ISSUE: launch/boss-intro crash on the new build. devs are aware — post your load order, don't spam new tickets 🙏", ago: "26m", sentiment: "neu", up: 21 },
    { author: "frame_dropout", role: "modder", body: "rolling back the animation mod cleared the null ref for me. did you run LOOT after installing?", ago: "42m", sentiment: "pos", up: 9 },
    { author: "stutter_sam", role: "player", body: "stutter is way worse since the patch, anyone on a 4070 seeing the same?", ago: "1h", sentiment: "mixed", up: 7 },
  ],
  // Reddit — PSA titles, detailed bodies, "is anyone else", EDIT: SOLVED culture
  reddit: [
    { author: "u/patchnoter", role: "player", body: "PSA: factory boss crash workaround — verify files + drop the texture mod. no more CTD", ago: "8m", sentiment: "pos", up: 38 },
    { author: "u/gpu_bound_greg", role: "player", body: "Is anyone else getting a CPU bottleneck in the city after the patch? 5800X3D / 3080, stutters every few seconds", ago: "22m", sentiment: "mixed", up: 17 },
    { author: "u/modloader_dev", role: "developer", body: "Stack points to BossIntroSequence.PlayCutscene() — looks like a missing asset ref introduced in 1.4.2", ago: "1h", sentiment: "neu", up: 11 },
    { author: "u/vanilla_vince", role: "player", body: "Not just you — the pinned megathread already has 200+ comments about the boss crash", ago: "2h", sentiment: "neu", up: 24 },
    { author: "u/LOOT_lyfe", role: "modder", body: "Sounds like a load-order issue. Run LOOT, post your sorted order, and we can take a look", ago: "3h", sentiment: "pos", up: 15 },
  ],
  // Steam — blunt, verdict-first reviews + terse discussion posts
  steam_reviews: [
    { author: "RefundRandy", role: "player", body: "Unplayable after the latest patch. Hard-crashes at the boss intro every time. Wait for a sale.", ago: "14m", sentiment: "neg", up: 5 },
    { author: "CozyGamerKel", role: "player", body: "Great update but the city runs like garbage now — constant micro-stutters even on a 4090", ago: "1h", sentiment: "mixed", up: 7 },
    { author: "verify_vera", role: "player", body: "[Help] Verify integrity of game files — found 2 corrupted files, re-downloaded, fixed the crash for me", ago: "2h", sentiment: "pos", up: 13 },
    { author: "altF4_aaron", role: "player", body: "Anyone else getting crash on alt-tab since the update? Win11 here", ago: "3h", sentiment: "neg", up: 3 },
  ],
  // Forums — structured, version-stamped, [SOLVED] tags, mod-author replies
  forum: [
    { author: "repro_required", role: "modder", body: "[Bug Report] v1.4.2 — CTD on factory boss cell transition, frame 2. Steps to repro + crash log attached.", ago: "33m", sentiment: "neg", up: 14 },
    { author: "Devlog_Dana", role: "developer", body: "Tracking the boss-intro crash; suspect a cutscene asset removed in 1.4.2. Confirming repro on 1.6.x but not 1.5.x.", ago: "2h", sentiment: "neu", up: 19 },
    { author: "nexus_nomad", role: "creator", body: "[SOLVED] It was a conflict — moving the patch below both masters resolved it. Marking solved for the next person who googles this.", ago: "4h", sentiment: "pos", up: 22 },
  ],
  default: [
    { author: "community", role: "player", body: "discussing the latest patch and a boss-intro crash", ago: "now", sentiment: "neu", up: 2 },
  ],
};

const LIVE: Record<string, string[]> = {
  discord: [
    "same here, ctd at the boss every time. GTX 1080 / win11",
    "load order screenshot? mine's clean and still crashing",
    "texture mod was it for me too, thanks modmancer 🙏",
    "anyone tried the script extender update? mine was out of date",
    "+1 crashing, did a clean reinstall and still ctd",
    "nvm fixed it — old version of the loader, updated and it's fine",
    "is this the known issue or a new one lol",
  ],
  reddit: [
    "Can confirm the workaround, no more crash. EDIT: SOLVED for me",
    "Bottleneck in the city for me too, frame cap just stopped working",
    "Cross-post: same CTD reported on the official forum megathread",
    "DDU'd my drivers + verified files, still stutters. At my wits' end",
    "Removed — please use the pinned Bug Megathread for patch issues",
  ],
  steam_reviews: [
    "edit: dropping the texture mod fixed it, bumping to positive 👍",
    "still crashes every 20 min, zero support response. refunding",
    "verify integrity found a corrupted file — fixed the freeze",
  ],
  forum: [
    "Attached my full crash log to the bug thread above",
    "Reproduced on a clean/vanilla profile with only this mod active",
    "Missing master error on install — does this need the DLC?",
    "Merging this into the existing megathread to keep reports together",
  ],
  default: ["new report just came in"],
};

const AUTHORS = ["ctd_andy", "LoadOrderLarry", "vanilla_vince", "pixelpriest", "frame_dropout", "modmancer", "stutter_sam", "patchnoter", "LOOT_lyfe", "repro_required", "nexus_nomad", "hotfix_hannah", "triage_tom", "papyrus_pat", "gpu_bound_greg"];
const ROLES: FeedMsg["role"][] = ["player", "player", "modder", "player", "creator"];

export function recentFor(kind: string): FeedMsg[] {
  return BASE[kind] ?? BASE.default;
}

export function liveFor(kind: string): FeedMsg {
  const pool = LIVE[kind] ?? LIVE.default;
  const sentiments: FeedMsg["sentiment"][] = ["neg", "neu", "pos", "mixed"];
  return {
    author: AUTHORS[Math.floor(Math.random() * AUTHORS.length)],
    role: ROLES[Math.floor(Math.random() * ROLES.length)],
    body: pool[Math.floor(Math.random() * pool.length)],
    ago: "just now",
    sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    up: Math.floor(Math.random() * 4),
  };
}
