// Synthetic live-feed content for the local demo. Real read-only adapters (M2)
// will replace this with actual scoped community items. Flavored per source.
export type FeedMsg = {
  author: string;
  role: "player" | "modder" | "developer" | "moderator" | "creator";
  body: string;
  ago: string;
  sentiment: "pos" | "neu" | "neg" | "mixed";
  up: number;
};

const BASE: Record<string, FeedMsg[]> = {
  discord: [
    { author: "voxel_knight", role: "player", body: "anyone else CTD right at the factory boss intro after 1.4.2?", ago: "just now", sentiment: "neg", up: 6 },
    { author: "ModMaven", role: "modder", body: "disable the HD texture pack — fixed the boss-intro crash for me", ago: "3m", sentiment: "pos", up: 12 },
    { author: "patch_gremlin", role: "player", body: "verified files, still crashing. mods: 14. anyone got a clean repro?", ago: "11m", sentiment: "neg", up: 4 },
    { author: "Aria (mod)", role: "moderator", body: "pinned: known issue at factory boss, devs are looking. post your load order pls", ago: "26m", sentiment: "neu", up: 21 },
    { author: "frame_chef", role: "modder", body: "rolling back the animation mod cleared the null ref for me", ago: "42m", sentiment: "pos", up: 9 },
  ],
  reddit: [
    { author: "u/grumblecube", role: "player", body: "PSA: factory boss crash workaround — verify files + drop the texture mod", ago: "8m", sentiment: "pos", up: 38 },
    { author: "u/citybuilder99", role: "player", body: "Anyone else CPU bottleneck in the city after the patch? 5800X3D here", ago: "22m", sentiment: "mixed", up: 17 },
    { author: "u/modloader_dev", role: "developer", body: "stack points to BossIntroSequence.PlayCutscene() — looks like a null asset ref", ago: "1h", sentiment: "neu", up: 11 },
  ],
  steam_reviews: [
    { author: "Helldiver_Hank", role: "player", body: "Great update but it hard-crashes at the boss intro on my rig. fix incoming?", ago: "14m", sentiment: "mixed", up: 5 },
    { author: "CozyGamerKel", role: "player", body: "Runs way better after 1.4.2 except the city is choppy now", ago: "1h", sentiment: "mixed", up: 7 },
    { author: "RefundRandy", role: "player", body: "crashes every boss intro since the patch. unplayable for me atm", ago: "3h", sentiment: "neg", up: 3 },
  ],
  forum: [
    { author: "BugHunterB", role: "modder", body: "[Bug] FATAL NullReferenceException at factory boss, frame 2 — repro inside", ago: "33m", sentiment: "neg", up: 14 },
    { author: "Devlog_Dana", role: "developer", body: "tracking the boss-intro crash; suspect a cutscene asset removed in 1.4.2", ago: "2h", sentiment: "neu", up: 19 },
  ],
  default: [
    { author: "community", role: "player", body: "discussing the latest patch and a boss-intro crash", ago: "now", sentiment: "neu", up: 2 },
  ],
};

const LIVE: Record<string, string[]> = {
  discord: [
    "same here, CTD at the boss every time",
    "load order screenshot? mine's clean and still crashing",
    "texture mod was it for me too, thanks ModMaven",
    "+1 crashing, GTX 1080 / win11",
    "anyone tried verok's hotfix patch?",
  ],
  reddit: [
    "can confirm the workaround, no more crash",
    "bottleneck in the city for me too, stutters hard",
    "cross-post: same crash on the official forum",
  ],
  steam_reviews: [
    "edit: dropping the texture mod fixed it, bumping to positive",
    "still crashing for me, please patch",
  ],
  forum: [
    "attached my full crash.log to the bug thread",
    "repro confirmed on a fresh install + 1 mod",
  ],
  default: ["new report just came in"],
};

const AUTHORS = ["nullptr_nate", "saveScummer", "pixel_pilgrim", "RTX_renee", "loadorder_lou", "mod_mage", "ctrl_alt_defeat"];
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
