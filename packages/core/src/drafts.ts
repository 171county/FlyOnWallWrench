import type { ActionType, EvidenceItem, HelpIntent, SourceKind } from "./types.js";

// Authentic, on-platform draft generation. Voice per surface comes from real
// community conventions (see docs/community-language-reference.md): Discord
// casual/lowercase, Steam blunt, Reddit PSA-style, forum structured. These are
// DRAFTS only — they never post; they flow into the approval queue.

export type DraftKind = "reply" | "known_issue" | "faq" | "poll" | "announcement" | "patch_notes";

// Optional tone override the user can pick before approving a draft.
// "auto" keeps the platform's native voice; the others restyle the text.
export type DraftTone = "auto" | "casual" | "friendly" | "official" | "technical";

export type DraftRequest = {
  kind: DraftKind;
  source: SourceKind;        // tailors voice + conventions to the target platform
  topic: string;             // the user's subject, e.g. "factory boss crash"
  intent?: HelpIntent;
  evidence?: EvidenceItem[]; // optional supporting evidence to fold in
  prevalence?: number;       // 0..1, how widespread (drives "known issue" tone)
  tone?: DraftTone;          // optional voice override
};

export type Draft = {
  kind: DraftKind;
  source: SourceKind;
  actionType: ActionType;
  title?: string;
  body: string;
  requiresApproval: true;
  voiceNote: string;         // why it reads the way it does, for the reviewer
};

const VOICE: Record<string, string> = {
  discord: "casual, lowercase, fast",
  reddit: "PSA/structured with specs",
  steam_reviews: "blunt, plain",
  steam_news: "official update tone",
  forum: "structured, version-stamped",
  github_discussions: "technical, repro-focused",
  github_issues: "technical, repro-focused",
};
const voiceOf = (s: SourceKind) => VOICE[s] ?? "clear and neutral";

function topEvidence(ev: EvidenceItem[] | undefined, n: number): string[] {
  return (ev ?? []).slice(0, n).map((e) => `- ${e.summary}`);
}

// ---- per-platform reply phrasing -------------------------------------------
function replyBody(req: DraftRequest): string {
  const { source, topic } = req;
  const ev = topEvidence(req.evidence, 2);
  switch (source) {
    case "discord":
      return [
        `hey — re: ${topic.toLowerCase()}, this is a known one rn 👇`,
        `can you drop your full load order + crash log? (and confirm you verified files / updated the script extender)`,
        ev.length ? `what's worked for others:\n${ev.join("\n")}` : `a few folks fixed it by rolling back the most recent mod and retesting from an earlier save`,
      ].join("\n\n");
    case "reddit":
      return [
        `Sounds like the ${topic} a lot of people are hitting after the patch — you're not alone.`,
        `To narrow it down, could you post: your specs, game/mod version, and full load order? Run LOOT and paste the sorted order if you can.`,
        ev.length ? `What's helped so far:\n${ev.join("\n")}` : `Common fix: verify files, then disable the most recent mod and retest. If it clears, it's a conflict — grab the compat patch.`,
      ].join("\n\n");
    case "steam_reviews":
      return [
        `Thanks for flagging the ${topic}. We can reproduce it and a fix is in the works.`,
        `In the meantime: verify integrity of game files, and disable the in-game overlay — that's cleared it for several players.`,
      ].join("\n\n");
    case "forum":
      return [
        `**Re: ${topic}**`,
        `Confirmed — this is a known issue introduced in the latest version. Tracking it now.`,
        `To help us triage, please attach your full crash log and the output of LOOT, and note whether it repros on a clean/vanilla profile.`,
        ev.length ? `Known workarounds:\n${ev.join("\n")}` : `Workaround: roll back to the previous version or use the steps in the sticky.`,
      ].join("\n\n");
    default:
      return [
        `Re: ${topic} — this looks like a known issue. Could you share your version, platform, and steps to reproduce?`,
        ev.length ? `What's helped:\n${ev.join("\n")}` : `Workaround: verify files and retest after disabling recent changes.`,
      ].join("\n\n");
  }
}

function knownIssueBody(req: DraftRequest): { title: string; body: string } {
  const widespread = (req.prevalence ?? 0) >= 0.4;
  const ev = topEvidence(req.evidence, 3);
  const title = `📌 Known Issue: ${req.topic}`;
  const body = [
    `**Status:** ${widespread ? "Widespread — acknowledged" : "Under investigation"}`,
    `We're aware of ${req.topic}${widespread ? " affecting many players" : ""} and are looking into it. Please don't open new reports for this — add details here instead.`,
    ev.length ? `**Reports so far:**\n${ev.join("\n")}` : "",
    `**What helps right now:** verify game files, disable the most recent mod/overlay, and retest from an earlier save.`,
    `**To help us fix it faster:** post your platform, version, full load order, and a crash log.`,
  ].filter(Boolean).join("\n\n");
  return { title, body };
}

function faqBody(req: DraftRequest): { title: string; body: string } {
  return {
    title: `FAQ: ${req.topic}`,
    body: [
      `**Q: ${req.topic}?**`,
      `A: This is a known issue. First steps:`,
      `1. Verify game files.\n2. Disable the most recently added mod/overlay.\n3. Retest from an earlier save.\n4. If it clears, it's a conflict — install the compatibility patch.`,
      `Still stuck? Post your version, load order, and crash log and we'll take a look.`,
    ].join("\n\n"),
  };
}

function pollBody(req: DraftRequest): { title: string; body: string } {
  return {
    title: `Quick poll: ${req.topic}`,
    body: [
      `Trying to gauge how widespread ${req.topic} is. React/vote:`,
      `🔴 Hitting it consistently\n🟡 Sometimes / after specific actions\n🟢 Not seeing it`,
      `If you're affected, drop your platform + version so we can spot a pattern.`,
    ].join("\n\n"),
  };
}

function announcementBody(req: DraftRequest): { title: string; body: string } {
  return {
    title: `Update on: ${req.topic}`,
    body: [
      `We've seen the reports about ${req.topic} and wanted to give a heads-up.`,
      `We can reproduce it internally and a hotfix is in progress. We'll update this post when it ships.`,
      `Thanks for the detailed reports and patience 🙏`,
    ].join("\n\n"),
  };
}

const ACTION_TYPE: Record<DraftKind, ActionType> = {
  reply: "reply",
  known_issue: "known_issue",
  faq: "faq",
  poll: "poll",
  announcement: "announcement",
  patch_notes: "announcement",
};

export function composeDraft(req: DraftRequest): Draft {
  let title: string | undefined;
  let body: string;

  switch (req.kind) {
    case "reply": body = replyBody(req); break;
    case "known_issue": ({ title, body } = knownIssueBody(req)); break;
    case "faq": ({ title, body } = faqBody(req)); break;
    case "poll": ({ title, body } = pollBody(req)); break;
    case "announcement":
    case "patch_notes": ({ title, body } = announcementBody(req)); break;
    default: body = replyBody(req);
  }

  const tone = req.tone ?? "auto";
  return {
    kind: req.kind,
    source: req.source,
    actionType: ACTION_TYPE[req.kind],
    title,
    body: applyTone(body, tone),
    requiresApproval: true,
    voiceNote: tone === "auto" ? `${req.source} voice: ${voiceOf(req.source)}` : `${tone} tone`,
  };
}

// Lightweight, deterministic tone restyling. Keeps content intact; adjusts
// register/openers/casing so the user can swap casual <-> official before
// approving, without an LLM round-trip.
export function applyTone(body: string, tone: DraftTone): string {
  if (tone === "auto") return body;

  if (tone === "official") {
    let b = body
      .replace(/\bhey+\b[ ,—-]*/gi, "")
      .replace(/\brn\b/gi, "right now")
      .replace(/\bpls\b/gi, "please")
      .replace(/\blmk\b/gi, "let us know")
      .replace(/\bu\b/gi, "you")
      .replace(/[ ]*[👇🙏💀✦]/gu, "")
      .replace(/!+/g, ".");
    // Capitalize first letter of each line.
    b = b.replace(/^(\s*)([a-z])/gm, (_m, s, c) => s + c.toUpperCase());
    return `Thanks for the report. ${b}`.trim();
  }

  if (tone === "technical") {
    return [
      body,
      "",
      "Please include: platform/OS, game & mod versions, full load order (LOOT-sorted), and the complete crash log. Note whether it reproduces on a clean/vanilla profile.",
    ].join("\n");
  }

  if (tone === "casual") {
    return body
      .replace(/^Thanks for (the report|flagging[^.]*)\.\s*/i, "heads up — ")
      .replace(/\bplease\b/gi, "pls")
      .replace(/\bWe can reproduce it\b/gi, "yeah we can repro it");
  }

  if (tone === "friendly") {
    return `${body}\n\nReally appreciate you flagging this — we'll keep you posted! 🙏`;
  }

  return body;
}

// Which drafts make sense for a detected intent — drives the action buttons.
export function suggestedDraftsFor(intent: HelpIntent | undefined): DraftKind[] {
  switch (intent) {
    case "crash_support":
    case "install_help":
    case "compatibility_question": return ["reply", "known_issue", "faq"];
    case "performance_bottleneck":
    case "known_issue_check": return ["known_issue", "poll", "reply"];
    case "community_sentiment":
    case "idea_pull": return ["poll", "announcement"];
    case "announcement_drafting": return ["announcement", "patch_notes"];
    default: return ["reply", "faq"];
  }
}
