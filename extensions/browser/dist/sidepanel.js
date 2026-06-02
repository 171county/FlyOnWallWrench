// ../../packages/core/dist/router.js
function classifyIntent(message) {
  const text = message.toLowerCase();
  if (/(crash|ctd|freeze|fatal|exception|stack trace|segfault)/.test(text))
    return "crash_support";
  if (/(fps|stutter|bottleneck|lag|cpu|gpu|frame|performance)/.test(text))
    return "performance_bottleneck";
  if (/(install|setup|load order|dependency|missing|won't load|wont load)/.test(text))
    return "install_help";
  if (/(compatible|compatibility|conflict|breaks|works with)/.test(text))
    return "compatibility_question";
  if (/(known issue|anyone else|others seeing|widespread)/.test(text))
    return "known_issue_check";
  if (/(what are people saying|sentiment|mad about|complaining)/.test(text))
    return "community_sentiment";
  if (/(ideas|feature requests|want from|wishlist|next update)/.test(text))
    return "idea_pull";
  if (/(ask the community|push this idea|poll|rfc)/.test(text))
    return "idea_push";
  if (/(draft|reply|respond)/.test(text))
    return "reply_drafting";
  if (/(announcement|patch notes|post update)/.test(text))
    return "announcement_drafting";
  if (/(triage|bug report|repro|issue)/.test(text))
    return "triage";
  return "unknown";
}
var candidateByIntent = {
  crash_support: {
    required: ["discord", "forum"],
    optional: ["steam_reviews", "reddit", "github_issues", "github_discussions"],
    avoided: ["youtube", "twitch"]
  },
  performance_bottleneck: {
    required: ["discord", "steam_reviews"],
    optional: ["reddit", "forum", "youtube", "github_issues"],
    avoided: []
  },
  install_help: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_issues", "github_discussions"],
    avoided: ["twitch"]
  },
  compatibility_question: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_issues", "github_discussions", "steam_reviews"],
    avoided: []
  },
  known_issue_check: {
    required: ["discord", "steam_reviews"],
    optional: ["reddit", "forum", "github_issues", "github_discussions"],
    avoided: []
  },
  community_sentiment: {
    required: ["discord", "steam_reviews", "reddit"],
    optional: ["forum", "youtube", "twitch"],
    avoided: []
  },
  idea_pull: {
    required: ["discord", "reddit", "steam_reviews"],
    optional: ["forum", "youtube", "github_discussions"],
    avoided: []
  },
  idea_push: {
    required: ["discord", "forum"],
    optional: ["reddit", "github_discussions"],
    avoided: []
  },
  reply_drafting: {
    required: [],
    optional: ["discord", "reddit", "forum", "github_discussions", "youtube"],
    avoided: []
  },
  announcement_drafting: {
    required: ["discord", "steam_news"],
    optional: ["reddit", "forum", "youtube"],
    avoided: []
  },
  triage: {
    required: ["discord", "github_issues"],
    optional: ["forum", "reddit", "steam_reviews"],
    avoided: []
  },
  unknown: {
    required: ["discord", "forum"],
    optional: ["reddit", "steam_reviews"],
    avoided: []
  }
};
function scopeSources(intent, context) {
  const plan = candidateByIntent[intent];
  const connected3 = new Set(context.connectedSources.filter((s) => s.read).map((s) => s.source));
  const onlyConnected = (sources2) => sources2.filter((source) => connected3.has(source));
  return {
    required: onlyConnected(plan.required),
    optional: onlyConnected(plan.optional),
    avoided: plan.avoided
  };
}
function selectSources(intent, context) {
  const scope = scopeSources(intent, context);
  const selected = [...scope.required];
  for (const source of scope.optional) {
    if (selected.length >= 4)
      break;
    if (!selected.includes(source))
      selected.push(source);
  }
  return selected;
}

// ../../packages/core/dist/evidenceRanker.js
function scoreEvidence(item) {
  const s = item.confidenceSignals;
  return s.semanticMatch * 0.28 + s.exactTermMatch * 0.18 + s.recency * 0.16 + s.sourceTrust * 0.12 + Math.min(s.confirmationCount / 10, 1) * 0.12 + s.sameVersionBonus * 0.06 + s.resolvedBonus * 0.05 - s.duplicatePenalty * 0.08 - s.lowQualityPenalty * 0.08;
}
function rankEvidence(items2) {
  return [...items2].sort((a, b) => scoreEvidence(b) - scoreEvidence(a));
}
function aggregateConfidence(items2) {
  if (items2.length === 0)
    return 0;
  const top = rankEvidence(items2).slice(0, 5);
  const avg = top.reduce((sum, item) => sum + scoreEvidence(item), 0) / top.length;
  return Math.max(0, Math.min(1, avg));
}

// ../../packages/core/dist/privacyRedactor.js
function privacyNotice(retention) {
  return retention === "ephemeral" ? "Scoped evidence was used for this task and should be discarded by MCP-owned storage after the response." : "Workspace is configured for user-owned retention; MCP-owned storage should still avoid sensitive bodies.";
}

// ../../packages/core/dist/communityHelp.js
async function communityHelp(request, context, adapters) {
  const intent = classifyIntent(request.userMessage);
  const selectedSources = new Set(selectSources(intent, context));
  const selectedAdapters = adapters.filter((adapter) => selectedSources.has(adapter.kind));
  if (selectedAdapters.length === 0) {
    return {
      status: "no_relevant_sources",
      workspaceId: context.workspaceId,
      intent,
      confidence: 0,
      answer: "I do not see relevant connected communication sources for this request yet.",
      sourcesUsed: [],
      evidence: [],
      suggestedActions: [
        { type: "connect_source", label: "Connect a community source for this workspace", requiresApproval: true }
      ],
      privacyNotice: privacyNotice(context.defaultPolicy.retention)
    };
  }
  const evidence = rankEvidence((await Promise.all(selectedAdapters.map((adapter) => adapter.search({
    query: request.userMessage,
    intent,
    projectHint: request.projectHint,
    timeWindow: request.timeWindow ?? "14d",
    maxEvidence: 10
  }, context)))).flat()).slice(0, 10);
  const confidence = aggregateConfidence(evidence);
  const sourcesUsed = [...new Set(evidence.map((item) => item.source))];
  const answer = buildConversationalAnswer(request.userMessage, intent, confidence, evidence);
  const followupQuestion = confidence < 0.72 ? followupForIntent(intent) : void 0;
  return {
    status: followupQuestion ? "needs_followup" : "ok",
    workspaceId: context.workspaceId,
    intent,
    confidence,
    answer,
    followupQuestion,
    sourcesUsed,
    evidence,
    suggestedActions: suggestedActionsForIntent(intent),
    privacyNotice: privacyNotice(context.defaultPolicy.retention)
  };
}
function buildConversationalAnswer(userMessage, intent, confidence, evidence) {
  if (evidence.length === 0) {
    return "I could not find enough connected community evidence yet. I can still help draft a troubleshooting checklist if you provide version, platform, and any logs or mod list details.";
  }
  const top = evidence.slice(0, 3).map((item, index) => `${index + 1}. ${item.summary}`).join("\n");
  if (intent === "crash_support") {
    return `This looks like a crash-support issue. Based on the strongest matching community evidence, start with these steps:

${top}

Confidence: ${Math.round(confidence * 100)}%.`;
  }
  if (intent === "performance_bottleneck") {
    return `I found related performance/bottleneck chatter. The strongest pattern is:

${top}

Confidence: ${Math.round(confidence * 100)}%.`;
  }
  if (intent === "idea_pull") {
    return `I found repeated idea/request signals. The top themes are:

${top}

Confidence: ${Math.round(confidence * 100)}%.`;
  }
  return `I found relevant community evidence for: "${userMessage}".

${top}

Confidence: ${Math.round(confidence * 100)}%.`;
}
function followupForIntent(intent) {
  if (intent === "crash_support")
    return "What platform, game/mod version, and recent changes are involved?";
  if (intent === "performance_bottleneck")
    return "What hardware or server setup, location/stage, and patch version are involved?";
  if (intent === "install_help")
    return "Can you share the exact error message and whether this is a fresh install or update?";
  return "Can you share one more detail so I can narrow the search?";
}
function suggestedActionsForIntent(intent) {
  if (intent === "crash_support") {
    return [
      { type: "draft_faq", label: "Draft a known-issue FAQ", requiresApproval: true },
      { type: "draft_reply", label: "Draft a support reply asking for logs and version", requiresApproval: true }
    ];
  }
  if (intent === "performance_bottleneck") {
    return [
      { type: "draft_report_template", label: "Draft a performance report template", requiresApproval: true },
      { type: "draft_poll", label: "Draft a poll to collect affected setups", requiresApproval: true }
    ];
  }
  return [{ type: "draft_reply", label: "Draft a response", requiresApproval: true }];
}

// ../../packages/core/dist/drafts.js
var VOICE = {
  discord: "casual, lowercase, fast",
  reddit: "PSA/structured with specs",
  steam_reviews: "blunt, plain",
  steam_news: "official update tone",
  forum: "structured, version-stamped",
  github_discussions: "technical, repro-focused",
  github_issues: "technical, repro-focused"
};
var voiceOf = (s) => VOICE[s] ?? "clear and neutral";
function topEvidence(ev, n) {
  return (ev ?? []).slice(0, n).map((e) => `- ${e.summary}`);
}
function replyBody(req) {
  const { source, topic } = req;
  const ev = topEvidence(req.evidence, 2);
  switch (source) {
    case "discord":
      return [
        `hey \u2014 re: ${topic.toLowerCase()}, this is a known one rn \u{1F447}`,
        `can you drop your full load order + crash log? (and confirm you verified files / updated the script extender)`,
        ev.length ? `what's worked for others:
${ev.join("\n")}` : `a few folks fixed it by rolling back the most recent mod and retesting from an earlier save`
      ].join("\n\n");
    case "reddit":
      return [
        `Sounds like the ${topic} a lot of people are hitting after the patch \u2014 you're not alone.`,
        `To narrow it down, could you post: your specs, game/mod version, and full load order? Run LOOT and paste the sorted order if you can.`,
        ev.length ? `What's helped so far:
${ev.join("\n")}` : `Common fix: verify files, then disable the most recent mod and retest. If it clears, it's a conflict \u2014 grab the compat patch.`
      ].join("\n\n");
    case "steam_reviews":
      return [
        `Thanks for flagging the ${topic}. We can reproduce it and a fix is in the works.`,
        `In the meantime: verify integrity of game files, and disable the in-game overlay \u2014 that's cleared it for several players.`
      ].join("\n\n");
    case "forum":
      return [
        `**Re: ${topic}**`,
        `Confirmed \u2014 this is a known issue introduced in the latest version. Tracking it now.`,
        `To help us triage, please attach your full crash log and the output of LOOT, and note whether it repros on a clean/vanilla profile.`,
        ev.length ? `Known workarounds:
${ev.join("\n")}` : `Workaround: roll back to the previous version or use the steps in the sticky.`
      ].join("\n\n");
    default:
      return [
        `Re: ${topic} \u2014 this looks like a known issue. Could you share your version, platform, and steps to reproduce?`,
        ev.length ? `What's helped:
${ev.join("\n")}` : `Workaround: verify files and retest after disabling recent changes.`
      ].join("\n\n");
  }
}
function knownIssueBody(req) {
  const widespread = (req.prevalence ?? 0) >= 0.4;
  const ev = topEvidence(req.evidence, 3);
  const title = `\u{1F4CC} Known Issue: ${req.topic}`;
  const body = [
    `**Status:** ${widespread ? "Widespread \u2014 acknowledged" : "Under investigation"}`,
    `We're aware of ${req.topic}${widespread ? " affecting many players" : ""} and are looking into it. Please don't open new reports for this \u2014 add details here instead.`,
    ev.length ? `**Reports so far:**
${ev.join("\n")}` : "",
    `**What helps right now:** verify game files, disable the most recent mod/overlay, and retest from an earlier save.`,
    `**To help us fix it faster:** post your platform, version, full load order, and a crash log.`
  ].filter(Boolean).join("\n\n");
  return { title, body };
}
function faqBody(req) {
  return {
    title: `FAQ: ${req.topic}`,
    body: [
      `**Q: ${req.topic}?**`,
      `A: This is a known issue. First steps:`,
      `1. Verify game files.
2. Disable the most recently added mod/overlay.
3. Retest from an earlier save.
4. If it clears, it's a conflict \u2014 install the compatibility patch.`,
      `Still stuck? Post your version, load order, and crash log and we'll take a look.`
    ].join("\n\n")
  };
}
function pollBody(req) {
  return {
    title: `Quick poll: ${req.topic}`,
    body: [
      `Trying to gauge how widespread ${req.topic} is. React/vote:`,
      `\u{1F534} Hitting it consistently
\u{1F7E1} Sometimes / after specific actions
\u{1F7E2} Not seeing it`,
      `If you're affected, drop your platform + version so we can spot a pattern.`
    ].join("\n\n")
  };
}
function announcementBody(req) {
  return {
    title: `Update on: ${req.topic}`,
    body: [
      `We've seen the reports about ${req.topic} and wanted to give a heads-up.`,
      `We can reproduce it internally and a hotfix is in progress. We'll update this post when it ships.`,
      `Thanks for the detailed reports and patience \u{1F64F}`
    ].join("\n\n")
  };
}
var ACTION_TYPE = {
  reply: "reply",
  known_issue: "known_issue",
  faq: "faq",
  poll: "poll",
  announcement: "announcement",
  patch_notes: "announcement"
};
function composeDraft(req) {
  let title;
  let body;
  switch (req.kind) {
    case "reply":
      body = replyBody(req);
      break;
    case "known_issue":
      ({ title, body } = knownIssueBody(req));
      break;
    case "faq":
      ({ title, body } = faqBody(req));
      break;
    case "poll":
      ({ title, body } = pollBody(req));
      break;
    case "announcement":
    case "patch_notes":
      ({ title, body } = announcementBody(req));
      break;
    default:
      body = replyBody(req);
  }
  const tone = req.tone ?? "auto";
  return {
    kind: req.kind,
    source: req.source,
    actionType: ACTION_TYPE[req.kind],
    title,
    body: applyTone(body, tone),
    requiresApproval: true,
    voiceNote: tone === "auto" ? `${req.source} voice: ${voiceOf(req.source)}` : `${tone} tone`
  };
}
function applyTone(body, tone) {
  if (tone === "auto")
    return body;
  if (tone === "official") {
    let b = body.replace(/\bhey+\b[ ,—-]*/gi, "").replace(/\brn\b/gi, "right now").replace(/\bpls\b/gi, "please").replace(/\blmk\b/gi, "let us know").replace(/\bu\b/gi, "you").replace(/[ ]*[👇🙏💀✦]/gu, "").replace(/!+/g, ".");
    b = b.replace(/^(\s*)([a-z])/gm, (_m, s, c) => s + c.toUpperCase());
    return `Thanks for the report. ${b}`.trim();
  }
  if (tone === "technical") {
    return [
      body,
      "",
      "Please include: platform/OS, game & mod versions, full load order (LOOT-sorted), and the complete crash log. Note whether it reproduces on a clean/vanilla profile."
    ].join("\n");
  }
  if (tone === "casual") {
    return body.replace(/^Thanks for (the report|flagging[^.]*)\.\s*/i, "heads up \u2014 ").replace(/\bplease\b/gi, "pls").replace(/\bWe can reproduce it\b/gi, "yeah we can repro it");
  }
  if (tone === "friendly") {
    return `${body}

Really appreciate you flagging this \u2014 we'll keep you posted! \u{1F64F}`;
  }
  return body;
}

// ../../packages/core/dist/mockWorkspace.js
var mockWorkspaceContext = {
  workspaceId: "demo_workspace",
  projects: ["Example Game", "Example Mod Toolkit"],
  connectedSources: [
    {
      source: "discord",
      read: true,
      write: "approval_required",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: true,
      supportsPrivateSpaces: true,
      supportsUserOwnedRetention: true,
      approvedSpaces: ["support", "bug-reports", "announcements", "feedback"]
    },
    {
      source: "steam_reviews",
      read: true,
      write: "disabled",
      supportsThreads: false,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false
    },
    {
      source: "reddit",
      read: true,
      write: "approval_required",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false
    },
    {
      source: "forum",
      read: true,
      write: "approval_required",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: true,
      supportsUserOwnedRetention: true
    }
  ],
  availableButNotEnabled: ["youtube", "twitch", "github_discussions", "github_issues", "slack", "matrix"],
  providerMode: "unset",
  defaultPolicy: {
    autoAnswerPrivateHelp: true,
    publicPosting: "approval_required",
    moderation: "disabled",
    privateDms: "disabled",
    retention: "ephemeral"
  }
};

// ../../packages/adapters/dist/baseMockAdapter.js
function syntheticEvidence(kind, query, intent) {
  const q = query.toLowerCase();
  const crash = /(crash|ctd|freeze|boss|stage)/.test(q);
  const perf = /(bottleneck|fps|stutter|cpu|gpu|performance)/.test(q);
  const summaries = crash ? [
    "Several users mention crashes around the same stage transition after the latest patch.",
    "A moderator suggested verifying files, disabling recent visual/animation changes, and retesting from an earlier save."
  ] : perf ? [
    "Multiple users describe frame pacing drops in dense areas after the update.",
    "Reports cluster around CPU-heavy scenes and script/mod load rather than pure GPU limits."
  ] : [
    "Community discussion contains related reports and practical follow-up questions.",
    "The strongest next step is to gather version, platform, and reproduction details."
  ];
  return summaries.map((summary, index) => ({
    id: `${kind}_ev_${index + 1}`,
    source: kind,
    title: `${kind} synthetic evidence ${index + 1}`,
    summary,
    sourceUrl: void 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    matchedTerms: query.split(/\s+/).slice(0, 5),
    confidenceSignals: {
      semanticMatch: 0.72 - index * 0.08,
      exactTermMatch: crash || perf ? 0.75 : 0.45,
      recency: 0.8,
      sourceTrust: 0.7,
      confirmationCount: index === 0 ? 6 : 2,
      sameVersionBonus: 0.4,
      resolvedBonus: 0.1,
      duplicatePenalty: 0,
      lowQualityPenalty: 0.05
    },
    redacted: true
  }));
}
var BaseMockAdapter = class {
  kind;
  capabilities;
  constructor(kind, overrides = {}) {
    this.kind = kind;
    this.capabilities = {
      source: kind,
      read: true,
      write: "approval_required",
      supportsThreads: true,
      supportsSearch: true,
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      ...overrides
    };
  }
  async search(request, _context) {
    return syntheticEvidence(this.kind, request.query, request.intent).slice(0, request.maxEvidence ?? 10);
  }
  async getThread(ref, _context) {
    return {
      ref,
      title: `${this.kind} thread placeholder`,
      items: [
        {
          id: `${this.kind}_item_1`,
          source: this.kind,
          threadId: ref.externalId,
          authorRef: "redacted_author",
          authorRole: "unknown",
          body: "Synthetic thread item for local demo. Replace with real source retrieval.",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          visibility: "public",
          permissions: { canQuote: false, canReply: false, canSummarize: true }
        }
      ],
      redacted: true
    };
  }
};

// ../../packages/adapters/dist/discordAdapter.js
var DiscordAdapter = class extends BaseMockAdapter {
  constructor() {
    super("discord", { supportsRealtime: true, supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
};

// ../../packages/adapters/dist/redditAdapter.js
var RedditAdapter = class extends BaseMockAdapter {
  constructor() {
    super("reddit", { supportsPrivateSpaces: false });
  }
};

// ../../packages/adapters/dist/steamAdapter.js
var SteamReviewsAdapter = class extends BaseMockAdapter {
  constructor() {
    super("steam_reviews", { write: "disabled", supportsThreads: false });
  }
};

// ../../packages/adapters/dist/forumAdapter.js
var ForumAdapter = class extends BaseMockAdapter {
  constructor() {
    super("forum", { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
};

// ../../packages/adapters/dist/githubAdapter.js
var GithubDiscussionsAdapter = class extends BaseMockAdapter {
  constructor() {
    super("github_discussions", { supportsPrivateSpaces: true, supportsUserOwnedRetention: true });
  }
};

// ../../packages/adapters/dist/customSourceAdapter.js
var CustomSourceAdapter = class {
  kind = "forum";
  // normalized bucket; cfg.id keeps identity
  capabilities;
  cfg;
  constructor(cfg2) {
    this.cfg = cfg2;
    this.capabilities = {
      source: "forum",
      read: true,
      write: "disabled",
      supportsThreads: true,
      supportsSearch: this.cfg.type === "discourse",
      supportsRealtime: false,
      supportsPrivateSpaces: false,
      supportsUserOwnedRetention: false,
      approvedSpaces: [cfg2.url]
    };
  }
  async fetchDiscourse(query, limit) {
    const base = this.cfg.url.replace(/\/+$/, "");
    const url = query ? `${base}/search.json?q=${encodeURIComponent(query)}` : `${base}/latest.json`;
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "HelpMeComms/0.1" } });
    if (!res.ok)
      throw new Error(`Discourse read failed (${res.status}) for ${this.cfg.label}`);
    const data = await res.json();
    const topics = data.topics ?? data.topic_list?.topics ?? [];
    return topics.slice(0, limit).map((t) => ({
      title: t.title,
      body: t.title,
      url: t.slug && t.id ? `${base}/t/${t.slug}/${t.id}` : base,
      createdAt: t.created_at
    }));
  }
  async fetchRss(limit) {
    const res = await fetch(this.cfg.url, { headers: { "user-agent": "HelpMeComms/0.1" } });
    if (!res.ok)
      throw new Error(`Feed read failed (${res.status}) for ${this.cfg.label}`);
    const xml = await res.text();
    const items2 = [];
    const blocks = xml.split(/<(?:item|entry)[ >]/i).slice(1);
    for (const b of blocks.slice(0, limit)) {
      const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(b)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = /<link[^>]*href="([^"]+)"/i.exec(b)?.[1] ?? /<link[^>]*>([\s\S]*?)<\/link>/i.exec(b)?.[1] ?? "";
      const date = /<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i.exec(b)?.[1] ?? "";
      if (title)
        items2.push({ title, body: title, url: link.trim(), createdAt: date.trim() || void 0 });
    }
    return items2;
  }
  async fetchItems(query, limit) {
    return this.cfg.type === "discourse" ? this.fetchDiscourse(query, limit) : this.fetchRss(limit);
  }
  async search(request, _context) {
    const terms = request.query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let items2 = [];
    try {
      items2 = await this.fetchItems(request.query, Math.max(20, request.maxEvidence ?? 10));
    } catch {
      return [];
    }
    const out = [];
    for (const it of items2) {
      const lower = `${it.title} ${it.body}`.toLowerCase();
      const matched = terms.filter((t) => lower.includes(t));
      if (terms.length && matched.length === 0 && this.cfg.type === "rss")
        continue;
      const ageDays = it.createdAt ? (Date.now() - Date.parse(it.createdAt)) / 864e5 : 7;
      out.push({
        id: `${this.cfg.id}_${out.length}`,
        source: "forum",
        title: it.title.slice(0, 120),
        summary: it.body.slice(0, 280),
        sourceUrl: it.url,
        createdAt: it.createdAt,
        matchedTerms: matched,
        confidenceSignals: {
          semanticMatch: terms.length ? Math.min(1, matched.length / terms.length) : 0.5,
          exactTermMatch: matched.length ? 0.65 : 0.4,
          recency: Number.isFinite(ageDays) ? Math.max(0, 1 - ageDays / 30) : 0.5,
          sourceTrust: 0.6,
          confirmationCount: 0,
          sameVersionBonus: 0,
          resolvedBonus: 0,
          duplicatePenalty: 0,
          lowQualityPenalty: it.title.length < 12 ? 0.2 : 0
        },
        redacted: true
      });
    }
    return out.slice(0, request.maxEvidence ?? 10);
  }
  async getThread(ref, _context) {
    const items2 = await this.fetchItems("", 25).catch(() => []);
    return {
      ref,
      title: this.cfg.label,
      redacted: true,
      items: items2.map((it, i) => ({
        id: `${this.cfg.id}_${i}`,
        source: "forum",
        authorRef: "redacted_author",
        authorRole: "unknown",
        body: it.title,
        createdAt: it.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
        url: it.url,
        visibility: "public",
        permissions: { canQuote: true, canReply: false, canSummarize: true }
      }))
    };
  }
};

// ../../packages/adapters/dist/wrenchBridges.js
var hit = (topic, terms) => {
  const t = topic.toLowerCase();
  return terms.some((w) => t.includes(w));
};
var MOD_STATION = { id: "mod", label: "ModWrench", tagline: "Every mod platform \xB7 load order \xB7 crashlog", color: "#4cc2ff", available: true };
var DEF_STATION = { id: "def", label: "DefWrench", tagline: "Studio toolchain \xB7 builds \xB7 tickets", color: "#e0964a", available: true };
var MYNE_STATION = { id: "myne", label: "MyneWrench", tagline: "Creator economies \xB7 Roblox \xB7 UEFN", color: "#2ee06a", available: true };
var FOTW_STATION = { id: "fotw", label: "FOTW\xB2", tagline: "Community brain \xB7 the cockpit", color: "#7d88c8", available: true };
var MockModBridge = class {
  id = "mod";
  station = MOD_STATION;
  async findings(topic) {
    const out = [];
    if (hit(topic, ["crash", "ctd", "boss", "freeze"])) {
      out.push({ wrench: "mod", kind: "load_order_hit", title: "Suspect mod in load order", detail: "Your load order has 'HD Texture Pack v3.1' enabled \u2014 recently updated and flagged in crashlogs at the same frame.", ref: "HD Texture Pack v3.1", weight: 0.85 });
      out.push({ wrench: "mod", kind: "crashlog", title: "Crashlog top frame", detail: "Last crashlog: NullRef in BossIntroSequence.PlayCutscene() \u2014 points to a missing cutscene asset.", ref: "crash.log", weight: 0.7 });
    }
    if (hit(topic, ["performance", "fps", "stutter", "bottleneck"])) {
      out.push({ wrench: "mod", kind: "load_order_hit", title: "Heavy script mod", detail: "Two script-heavy mods load late in your order; common cause of city-area stutter.", ref: "script mods", weight: 0.6 });
    }
    return out;
  }
};
var MockDevBridge = class {
  id = "def";
  station = DEF_STATION;
  async findings(topic) {
    const out = [];
    if (hit(topic, ["crash", "ctd", "boss", "asset", "cutscene"])) {
      out.push({ wrench: "def", kind: "open_ticket", title: "Matching Jira ticket", detail: "GAME-1423 'Boss intro cutscene asset removed in 1.4.2' is open and assigned \u2014 directly matches the crashlog.", ref: "GAME-1423", weight: 0.8 });
      out.push({ wrench: "def", kind: "build", title: "Last build touched it", detail: "Jenkins build #842 (last night) modified /assets/cutscenes/boss_intro \u2014 status: passing.", ref: "#842", weight: 0.55 });
    }
    return out;
  }
};
var MockCreatorBridge = class {
  id = "myne";
  station = MYNE_STATION;
  async findings(topic) {
    const out = [];
    if (hit(topic, ["crash", "review", "refund", "rating"])) {
      out.push({ wrench: "myne", kind: "economy", title: "Creator impact", detail: "Your Roblox experience's session length dipped this week and refund-flavored reviews are up \u2014 same window as the crash spike.", ref: "experience", weight: 0.4 });
    }
    return out;
  }
};
function createMockWrenchBridges() {
  return [new MockModBridge(), new MockDevBridge(), new MockCreatorBridge()];
}

// ../../packages/adapters/dist/index.js
function createDefaultMockAdapters() {
  return [
    new DiscordAdapter(),
    new RedditAdapter(),
    new SteamReviewsAdapter(),
    new ForumAdapter(),
    new GithubDiscussionsAdapter()
  ];
}

// src/shaderBg.ts
var VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;
var FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  p *= 1.6;
  float t = u_time * 0.045;

  // domain warp
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 1.5 * q + vec2(1.7, 9.2) + 0.5 * t),
                fbm(p + 1.5 * q + vec2(8.3, 2.8) - 0.5 * t));
  float f = fbm(p + 1.6 * r);

  vec3 deep  = vec3(0.020, 0.028, 0.045);  // gunmetal
  vec3 steel = vec3(0.30, 0.70, 1.00);     // steel cyan
  vec3 slate = vec3(0.40, 0.46, 0.70);     // slate blue
  vec3 amber = vec3(0.85, 0.55, 0.28);     // warm metal

  vec3 col = mix(deep, slate, clamp(f * 1.30, 0.0, 1.0));
  col = mix(col, steel, clamp(length(r) * 0.60, 0.0, 1.0));
  col = mix(col, amber, clamp(q.x * q.y * 1.10, 0.0, 1.0));   // subtle warmth
  col += steel * pow(f, 3.0) * 0.45;                          // cool cores
  col += vec3(0.16, 1.0, 0.50) * pow(f, 5.0) * 0.16;          // whisper of terminal green
  col *= smoothstep(1.25, 0.30, length(uv - 0.5));            // vignette
  col = mix(col * 0.5, col, 0.76);                            // keep it deep for contrast
  col += (hash(uv * (u_time + 1.0)) - 0.5) * 0.022;           // film grain

  gl_FragColor = vec4(col, 1.0);
}
`;
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}
function initShaderBackground(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    canvas.style.background = "#070a16";
    return;
  }
  const prog = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!prog || !vs || !fs) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener("resize", resize);
  const start = performance.now();
  function frame() {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1e3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// src/spatial.ts
function initParallax() {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.documentElement;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener("pointermove", (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  window.addEventListener("pointerleave", () => {
    tx = 0;
    ty = 0;
  });
  const loop = () => {
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.05;
    stage.style.setProperty("--ry", (cx * 2).toFixed(2) + "deg");
    stage.style.setProperty("--rx", (-cy * 2).toFixed(2) + "deg");
    root.style.setProperty("--px", (cx * -6).toFixed(1) + "px");
    root.style.setProperty("--py", (cy * -6).toFixed(1) + "px");
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// src/feed.ts
var BASE = {
  // Discord — fast, lowercase, fragmented, pings, emoji, logs as attachments
  discord: [
    { author: "ctd_andy", role: "player", body: "@here anyone else CTD right at the factory boss intro after 1.4.2? clean install", ago: "just now", sentiment: "neg", up: 6 },
    { author: "modmancer", role: "modder", body: "drop the HD texture pack \u2014 fixed the boss-intro crash for me. updated my modlist.txt too", ago: "3m", sentiment: "pos", up: 12 },
    { author: "papyrus_pat", role: "player", body: "verified files, reinstalled, still ctd. mods: 14. anyone got a clean repro? \u{1F480}", ago: "11m", sentiment: "neg", up: 4 },
    { author: "Aria", role: "moderator", body: "\u{1F4CC} KNOWN ISSUE: launch/boss-intro crash on the new build. devs are aware \u2014 post your load order, don't spam new tickets \u{1F64F}", ago: "26m", sentiment: "neu", up: 21 },
    { author: "frame_dropout", role: "modder", body: "rolling back the animation mod cleared the null ref for me. did you run LOOT after installing?", ago: "42m", sentiment: "pos", up: 9 },
    { author: "stutter_sam", role: "player", body: "stutter is way worse since the patch, anyone on a 4070 seeing the same?", ago: "1h", sentiment: "mixed", up: 7 }
  ],
  // Reddit — PSA titles, detailed bodies, "is anyone else", EDIT: SOLVED culture
  reddit: [
    { author: "u/patchnoter", role: "player", body: "PSA: factory boss crash workaround \u2014 verify files + drop the texture mod. no more CTD", ago: "8m", sentiment: "pos", up: 38 },
    { author: "u/gpu_bound_greg", role: "player", body: "Is anyone else getting a CPU bottleneck in the city after the patch? 5800X3D / 3080, stutters every few seconds", ago: "22m", sentiment: "mixed", up: 17 },
    { author: "u/modloader_dev", role: "developer", body: "Stack points to BossIntroSequence.PlayCutscene() \u2014 looks like a missing asset ref introduced in 1.4.2", ago: "1h", sentiment: "neu", up: 11 },
    { author: "u/vanilla_vince", role: "player", body: "Not just you \u2014 the pinned megathread already has 200+ comments about the boss crash", ago: "2h", sentiment: "neu", up: 24 },
    { author: "u/LOOT_lyfe", role: "modder", body: "Sounds like a load-order issue. Run LOOT, post your sorted order, and we can take a look", ago: "3h", sentiment: "pos", up: 15 }
  ],
  // Steam — blunt, verdict-first reviews + terse discussion posts
  steam_reviews: [
    { author: "RefundRandy", role: "player", body: "Unplayable after the latest patch. Hard-crashes at the boss intro every time. Wait for a sale.", ago: "14m", sentiment: "neg", up: 5 },
    { author: "CozyGamerKel", role: "player", body: "Great update but the city runs like garbage now \u2014 constant micro-stutters even on a 4090", ago: "1h", sentiment: "mixed", up: 7 },
    { author: "verify_vera", role: "player", body: "[Help] Verify integrity of game files \u2014 found 2 corrupted files, re-downloaded, fixed the crash for me", ago: "2h", sentiment: "pos", up: 13 },
    { author: "altF4_aaron", role: "player", body: "Anyone else getting crash on alt-tab since the update? Win11 here", ago: "3h", sentiment: "neg", up: 3 }
  ],
  // Forums — structured, version-stamped, [SOLVED] tags, mod-author replies
  forum: [
    { author: "repro_required", role: "modder", body: "[Bug Report] v1.4.2 \u2014 CTD on factory boss cell transition, frame 2. Steps to repro + crash log attached.", ago: "33m", sentiment: "neg", up: 14 },
    { author: "Devlog_Dana", role: "developer", body: "Tracking the boss-intro crash; suspect a cutscene asset removed in 1.4.2. Confirming repro on 1.6.x but not 1.5.x.", ago: "2h", sentiment: "neu", up: 19 },
    { author: "nexus_nomad", role: "creator", body: "[SOLVED] It was a conflict \u2014 moving the patch below both masters resolved it. Marking solved for the next person who googles this.", ago: "4h", sentiment: "pos", up: 22 }
  ],
  default: [
    { author: "community", role: "player", body: "discussing the latest patch and a boss-intro crash", ago: "now", sentiment: "neu", up: 2 }
  ]
};
var LIVE = {
  discord: [
    "same here, ctd at the boss every time. GTX 1080 / win11",
    "load order screenshot? mine's clean and still crashing",
    "texture mod was it for me too, thanks modmancer \u{1F64F}",
    "anyone tried the script extender update? mine was out of date",
    "+1 crashing, did a clean reinstall and still ctd",
    "nvm fixed it \u2014 old version of the loader, updated and it's fine",
    "is this the known issue or a new one lol"
  ],
  reddit: [
    "Can confirm the workaround, no more crash. EDIT: SOLVED for me",
    "Bottleneck in the city for me too, frame cap just stopped working",
    "Cross-post: same CTD reported on the official forum megathread",
    "DDU'd my drivers + verified files, still stutters. At my wits' end",
    "Removed \u2014 please use the pinned Bug Megathread for patch issues"
  ],
  steam_reviews: [
    "edit: dropping the texture mod fixed it, bumping to positive \u{1F44D}",
    "still crashes every 20 min, zero support response. refunding",
    "verify integrity found a corrupted file \u2014 fixed the freeze"
  ],
  forum: [
    "Attached my full crash log to the bug thread above",
    "Reproduced on a clean/vanilla profile with only this mod active",
    "Missing master error on install \u2014 does this need the DLC?",
    "Merging this into the existing megathread to keep reports together"
  ],
  default: ["new report just came in"]
};
var AUTHORS = ["ctd_andy", "LoadOrderLarry", "vanilla_vince", "pixelpriest", "frame_dropout", "modmancer", "stutter_sam", "patchnoter", "LOOT_lyfe", "repro_required", "nexus_nomad", "hotfix_hannah", "triage_tom", "papyrus_pat", "gpu_bound_greg"];
var ROLES = ["player", "player", "modder", "player", "creator"];
function recentFor(kind) {
  return BASE[kind] ?? BASE.default;
}
function liveFor(kind) {
  const pool = LIVE[kind] ?? LIVE.default;
  const sentiments = ["neg", "neu", "pos", "mixed"];
  return {
    author: AUTHORS[Math.floor(Math.random() * AUTHORS.length)],
    role: ROLES[Math.floor(Math.random() * ROLES.length)],
    body: pool[Math.floor(Math.random() * pool.length)],
    ago: "just now",
    sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
    up: Math.floor(Math.random() * 4)
  };
}

// src/signals.ts
var signals = [];
var listeners = /* @__PURE__ */ new Set();
function topicKey(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).slice(0, 6).sort().join(" ");
}
var STOP = /* @__PURE__ */ new Set(["this", "that", "with", "just", "like", "else", "crash", "crashing", "anyone", "after", "when", "where", "still", "game", "mods", "mod", "help", "what", "there", "here", "your", "have", "does", "didnt", "cant", "wont"]);
function addSignal(text, source) {
  signals.push({ topic: topicKey(text), source, at: Date.now() });
  const total = signals.length;
  listeners.forEach((fn) => fn(total));
  return total;
}
function localConfirmations(query) {
  const key = new Set(topicKey(query).split(" ").filter(Boolean));
  const hits = signals.filter((s) => {
    const words = s.topic.split(" ");
    return words.some((w) => key.has(w));
  });
  return { count: hits.length, sources: [...new Set(hits.map((h) => h.source))] };
}

// src/store.ts
var mem = {};
var hasChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;
async function load(key, fallback) {
  if (!hasChrome) return key in mem ? mem[key] : fallback;
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res?.[key] ?? fallback));
  });
}
function save(key, value) {
  if (!hasChrome) {
    mem[key] = value;
    return;
  }
  chrome.storage.local.set({ [key]: value });
}

// src/queue.ts
var KEY = "helpme.queue.v1";
var items = [];
var listeners2 = /* @__PURE__ */ new Set();
var seq = 0;
var ready = false;
async function hydrate() {
  items = await load(KEY, []);
  ready = true;
  emit();
}
function persist() {
  save(KEY, items);
}
function enqueue(input) {
  const item = { ...input, id: `q_${Date.now()}_${seq++}`, createdAt: Date.now(), status: "queued" };
  items.unshift(item);
  persist();
  emit();
  return item;
}
function setStatus(id, status) {
  const it = items.find((i) => i.id === id);
  if (it) {
    it.status = status;
    persist();
    emit();
  }
}
function updateBody(id, body) {
  const it = items.find((i) => i.id === id);
  if (it) {
    it.body = body;
    persist();
    emit();
  }
}
function applyEdit(id, patch) {
  const it = items.find((i) => i.id === id);
  if (it) {
    Object.assign(it, patch);
    persist();
    emit();
  }
}
function remove(id) {
  items = items.filter((i) => i.id !== id);
  persist();
  emit();
}
function clearResolved() {
  items = items.filter((i) => i.status === "queued");
  persist();
  emit();
}
function list() {
  return items;
}
function pendingCount() {
  return items.filter((i) => i.status === "queued").length;
}
function onChange(fn) {
  listeners2.add(fn);
}
function emit() {
  listeners2.forEach((fn) => fn());
}

// src/prefs.ts
var KEY2 = "helpme.prefs.v1";
var prefs = {};
async function hydratePrefs() {
  prefs = await load(KEY2, {});
}
function getTargets(fallback) {
  return prefs.targets ?? fallback;
}
function setTargets(targets) {
  prefs = { ...prefs, targets };
  save(KEY2, prefs);
}
function getLastTab() {
  return prefs.lastTab;
}
function setLastTab(lastTab) {
  prefs = { ...prefs, lastTab };
  save(KEY2, prefs);
}

// src/settings.ts
var KEY3 = "helpme.settings.v1";
var DEFAULTS = { trickleMs: 4500, trickle: true };
var settings = { ...DEFAULTS };
var listeners3 = /* @__PURE__ */ new Set();
async function hydrateSettings() {
  settings = { ...DEFAULTS, ...await load(KEY3, {}) };
}
function getSettings() {
  return settings;
}
function setSettings(patch) {
  settings = { ...settings, ...patch };
  save(KEY3, settings);
  emit2();
}
function onSettingsChange(fn) {
  listeners3.add(fn);
}
function emit2() {
  listeners3.forEach((fn) => fn());
}

// src/pageReaders.ts
function pageScrapeFn(site) {
  const txt = (el2) => (el2?.textContent || "").trim();
  const clip = (s, n = 280) => s.replace(/\s+/g, " ").trim().slice(0, n);
  const out = [];
  const push = (author, body, ago = "") => {
    body = clip(body);
    if (body && body.length > 1) out.push({ author: author || "user", body, ago });
  };
  try {
    if (site === "discord") {
      const items2 = document.querySelectorAll('[id^="chat-messages-"], [data-list-item-id^="chat-messages"]');
      let lastAuthor = "";
      items2.forEach((it) => {
        const a = it.querySelector('[class*="username"]');
        const author = txt(a) || lastAuthor;
        if (txt(a)) lastAuthor = author;
        const content = it.querySelector('[id^="message-content-"], [class*="messageContent"]');
        push(author, txt(content));
      });
    } else if (site === "reddit") {
      document.querySelectorAll("shreddit-post").forEach((p) => {
        const title = p.getAttribute("post-title") || txt(p.querySelector('[slot="title"]'));
        const author = p.getAttribute("author") || "redditor";
        push(author, title);
      });
      document.querySelectorAll('[slot="comment"], [data-testid="comment"]').forEach((c) => {
        push("redditor", txt(c));
      });
    } else if (site === "steam") {
      document.querySelectorAll(".apphub_Card, .commentthread_comment, .forum_op, .topic_message").forEach((card) => {
        const author = txt(card.querySelector(".apphub_CardContentAuthorName, .commentthread_author_link, .forum_op_author")) || "player";
        const body = txt(card.querySelector(".apphub_CardTextContent, .commentthread_comment_text, .content, .forum_op_text"));
        push(author, body);
      });
    } else if (site === "github") {
      document.querySelectorAll(".js-comment-body, .markdown-body, .comment-body").forEach((c) => {
        push("contributor", txt(c));
      });
      const t = txt(document.querySelector(".js-issue-title, .markdown-title, bdi.js-issue-title"));
      if (t) out.unshift({ author: "issue", body: clip(t), ago: "" });
    } else {
      document.querySelectorAll("article p, .post p, main p").forEach((p) => push("page", txt(p)));
    }
  } catch {
  }
  const seen = /* @__PURE__ */ new Set();
  return out.filter((m) => {
    const k = m.body.slice(0, 60);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 25);
}
var SITE_INFO = {
  discord: { scrapeKey: "discord", match: /(^|\.)discord\.com$/, origin: "https://discord.com/*", label: "Discord" },
  reddit: { scrapeKey: "reddit", match: /(^|\.)reddit\.com$/, origin: "https://*.reddit.com/*", label: "Reddit" },
  steam_reviews: { scrapeKey: "steam", match: /(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$/, origin: "https://*.steamcommunity.com/*", label: "Steam" },
  github_issues: { scrapeKey: "github", match: /(^|\.)github\.com$/, origin: "https://github.com/*", label: "GitHub" }
};

// src/connections.ts
var KEY4 = "helpme.connections.v1";
var connected = /* @__PURE__ */ new Set();
var listeners4 = /* @__PURE__ */ new Set();
async function hydrateConnections() {
  const saved = await load(KEY4, []);
  connected = new Set(saved);
  if (typeof chrome !== "undefined" && chrome.permissions?.getAll) {
    await new Promise((resolve) => {
      chrome.permissions.getAll((p) => {
        const origins = new Set(p.origins ?? []);
        for (const [src, info] of Object.entries(SITE_INFO)) {
          if (origins.has(info.origin)) connected.add(src);
          else connected.delete(src);
        }
        resolve();
      });
    });
    save(KEY4, [...connected]);
  }
}
function isConnected(src) {
  return connected.has(src);
}
async function connect(src) {
  const info = SITE_INFO[src];
  if (!info || typeof chrome === "undefined" || !chrome.permissions?.request) return false;
  const granted = await new Promise((resolve) => {
    chrome.permissions.request({ origins: [info.origin] }, (ok) => resolve(!!ok));
  });
  if (granted) {
    connected.add(src);
    save(KEY4, [...connected]);
    emit3();
  }
  return granted;
}
function emit3() {
  listeners4.forEach((fn) => fn());
}

// src/liveReader.ts
function siteForUrl(url) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return void 0;
  }
  for (const [src, info] of Object.entries(SITE_INFO)) if (info.match.test(host)) return src;
  return void 0;
}
async function readActiveTab() {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return { ok: false, reason: "no_tab" };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { ok: false, reason: "no_tab" };
  const site = siteForUrl(tab.url);
  if (!site) return { ok: false, reason: "not_on_site" };
  const info = SITE_INFO[site];
  const hasPerm = await new Promise(
    (resolve) => chrome.permissions.contains({ origins: [info.origin] }, (ok) => resolve(!!ok))
  );
  if (!hasPerm) return { ok: false, reason: "no_permission", site };
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageScrapeFn,
      args: [info.scrapeKey]
    });
    const messages = res?.result ?? [];
    return { ok: true, site, url: tab.url, messages };
  } catch {
    return { ok: false, reason: "blocked", site };
  }
}

// src/snatch.ts
function overlayPicker() {
  return new Promise((resolve) => {
    const prev = document.getElementById("__fotw_snatch__");
    if (prev) prev.remove();
    const root = document.createElement("div");
    root.id = "__fotw_snatch__";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(7,10,17,.32);";
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;border:2px solid #2ee06a;background:rgba(46,224,106,.12);box-shadow:0 0 0 99999px rgba(7,10,17,.32);display:none;pointer-events:none;";
    const hint = document.createElement("div");
    hint.textContent = "SnatchIt \u2014 drag a box \xB7 Esc to cancel";
    hint.style.cssText = "position:fixed;top:14px;left:50%;transform:translateX(-50%);font:600 12px ui-sans-serif,system-ui;color:#eaf2ff;background:rgba(7,10,17,.8);border:1px solid rgba(46,224,106,.5);padding:6px 12px;border-radius:999px;pointer-events:none;";
    root.append(box, hint);
    document.body.appendChild(root);
    let sx = 0, sy = 0, dragging = false;
    const done = (r) => {
      root.remove();
      window.removeEventListener("keydown", onKey);
      resolve(r);
    };
    const onKey = (e) => {
      if (e.key === "Escape") done(null);
    };
    window.addEventListener("keydown", onKey);
    root.addEventListener("mousedown", (e) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      box.style.display = "block";
    });
    root.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      box.style.left = x + "px";
      box.style.top = y + "px";
      box.style.width = w + "px";
      box.style.height = h + "px";
    });
    root.addEventListener("mouseup", (e) => {
      dragging = false;
      const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      if (w < 6 || h < 6) return done(null);
      done({ x, y, w, h, dpr: window.devicePixelRatio || 1 });
    });
  });
}
async function ensureCapturePermission(tabUrl) {
  try {
    const origin = new URL(tabUrl).origin + "/*";
    const has = await new Promise((r) => chrome.permissions.contains({ origins: [origin] }, (ok) => r(!!ok)));
    if (has) return true;
    return await new Promise((r) => chrome.permissions.request({ origins: [origin] }, (ok) => r(!!ok)));
  } catch {
    return false;
  }
}
function cropDataUrl(fullDataUrl, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = rect.x * rect.dpr, sy = rect.y * rect.dpr, sw = rect.w * rect.dpr, sh = rect.h * rect.dpr;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height });
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = fullDataUrl;
  });
}
async function snatch() {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) return { ok: false, reason: "no_tab" };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { ok: false, reason: "no_tab" };
  let rect = null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: overlayPicker });
    rect = res?.result ?? null;
  } catch {
    return { ok: false, reason: "blocked" };
  }
  if (!rect) return { ok: false, reason: "cancelled" };
  if (!await ensureCapturePermission(tab.url)) return { ok: false, reason: "no_permission" };
  try {
    const fullDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const cropped = await cropDataUrl(fullDataUrl, rect);
    return { ok: true, ...cropped };
  } catch {
    return { ok: false, reason: "blocked" };
  }
}

// ../../packages/pro/dist/correlate.js
var ORDER = ["fotw", "mod", "def", "myne"];
async function correlate(topic, bridges) {
  const all = (await Promise.all(bridges.map((b) => b.findings(topic).catch(() => [])))).flat();
  const findings = [...all].sort((a, b) => {
    const oa = ORDER.indexOf(a.wrench), ob = ORDER.indexOf(b.wrench);
    if (oa !== ob)
      return oa - ob;
    return b.weight - a.weight;
  });
  const contributors = [...new Set(findings.map((f) => f.wrench))];
  const confidence = findings.length ? Math.min(1, findings.reduce((s, f) => s + f.weight, 0) / Math.max(3, findings.length)) * (0.5 + 0.5 * Math.min(1, contributors.length / 3)) : 0;
  return { topic, findings, story: buildStory(topic, findings), contributors, confidence };
}
function buildStory(topic, findings) {
  if (!findings.length)
    return `No connected wrench findings for "${topic}" yet.`;
  const byWrench = (w) => findings.filter((f) => f.wrench === w);
  const parts = [];
  const fotw = byWrench("fotw");
  if (fotw.length)
    parts.push(`Community: ${fotw[0].detail}`);
  const mod = byWrench("mod");
  if (mod.length)
    parts.push(`Likely cause: ${mod[0].detail}`);
  const def = byWrench("def");
  if (def.length)
    parts.push(`On the dev side: ${def[0].detail}`);
  const myne = byWrench("myne");
  if (myne.length)
    parts.push(`Creator impact: ${myne[0].detail}`);
  return parts.join("  \u2192  ");
}

// src/rack.ts
var KEY5 = "helpme.rack.v1";
var paired = /* @__PURE__ */ new Set(["fotw"]);
var listeners5 = /* @__PURE__ */ new Set();
async function hydrateRack() {
  const saved = await load(KEY5, ["fotw", "mod", "def"]);
  paired = new Set(saved.length ? saved : ["fotw"]);
  paired.add("fotw");
}
function isPaired(id) {
  return paired.has(id);
}
function listPaired() {
  return [...paired];
}
function togglePair(id) {
  if (id === "fotw") return;
  if (paired.has(id)) paired.delete(id);
  else paired.add(id);
  save(KEY5, [...paired]);
  emit4();
}
function emit4() {
  listeners5.forEach((fn) => fn());
}

// src/helperLink.ts
var KEY6 = "helpme.helper.v1";
var cfg = null;
async function hydrateHelper() {
  const saved = await load(KEY6, null);
  cfg = saved && saved.url ? saved : null;
}
function getHelper() {
  return cfg;
}
function setHelper(url, token) {
  cfg = url ? { url: url.replace(/\/+$/, ""), token } : null;
  save(KEY6, cfg);
}
var HelperBridge = class {
  constructor(id, station, base, token) {
    this.id = id;
    this.station = station;
    this.base = base;
    this.token = token;
  }
  async findings(topic) {
    try {
      const res = await fetch(`${this.base}/wrench/${this.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-fotw-token": this.token },
        body: JSON.stringify({ tool: "correlate", args: { topic } })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.findings ?? []).map((f) => ({ ...f, wrench: this.id }));
    } catch {
      return [];
    }
  }
};
async function liveHelperBridges(stationFor) {
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/wrenches`);
    if (!res.ok) return null;
    const data = await res.json();
    const list2 = data.wrenches ?? [];
    if (!list2.length) return null;
    return list2.map((w) => new HelperBridge(w.id, stationFor(w.id), cfg.url, cfg.token));
  } catch {
    return null;
  }
}

// src/customSources.ts
var KEY7 = "helpme.custom.v1";
var sources = [];
var listeners6 = /* @__PURE__ */ new Set();
async function hydrateCustom() {
  sources = await load(KEY7, []);
}
function listCustom() {
  return sources;
}
function addCustom(input) {
  const id = `custom_${input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;
  const src = { ...input, id };
  sources = [...sources, src];
  save(KEY7, sources);
  emit5();
  return src;
}
function removeCustom(id) {
  sources = sources.filter((s) => s.id !== id);
  save(KEY7, sources);
  emit5();
}
function onCustomChange(fn) {
  listeners6.add(fn);
}
function emit5() {
  listeners6.forEach((fn) => fn());
}

// src/sidepanel.ts
var queueBody = null;
var activeView = "ask";
initShaderBackground("bg");
initParallax();
var SOURCE_META = {
  discord: { label: "Discord", color: "#5865f2" },
  reddit: { label: "Reddit", color: "#ff4500" },
  steam_reviews: { label: "Steam", color: "#66c0f4" },
  steam_news: { label: "Steam News", color: "#66c0f4" },
  forum: { label: "Forum", color: "#2ee06a" },
  github_discussions: { label: "GitHub", color: "#c9d1d9" },
  github_issues: { label: "GitHub Issues", color: "#c9d1d9" },
  youtube: { label: "YouTube", color: "#ff4d9d" },
  twitch: { label: "Twitch", color: "#8b5cff" },
  slack: { label: "Slack", color: "#36c5f0" },
  matrix: { label: "Matrix", color: "#0dbd8b" }
};
var meta = (s) => SOURCE_META[s] ?? { label: s, color: "#9aa6c4" };
var SENT = { pos: "#2ee06a", neu: "#7d88c8", neg: "#ff7a3c", mixed: "#e0964a" };
var workspace = mockWorkspaceContext;
var allAdapters = createDefaultMockAdapters();
var adapterFor = (kind) => allAdapters.find((a) => a.kind === kind) ?? new BaseMockAdapter(kind);
var connected2 = workspace.connectedSources.filter((s) => s.read);
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== void 0) node.textContent = text;
  return node;
}
function meterEl(value) {
  const pct = Math.round(value * 100);
  const wrap = el("div");
  wrap.append(el("div", "meter-label", "Confidence"));
  const row = el("div", "meter-wrap");
  const m = el("div", "meter");
  const i = el("i");
  i.style.width = pct + "%";
  m.append(i);
  row.append(m, el("span", "meter-val", pct + "%"));
  wrap.append(row);
  return wrap;
}
function pillsEl(sources2) {
  const pills = el("div", "pills");
  for (const s of sources2) {
    const pill = el("span", "pill");
    const led = el("span", "led");
    led.style.color = meta(s).color;
    pill.append(led, document.createTextNode(meta(s).label));
    pills.append(pill);
  }
  return pills;
}
function evidenceEl(items2) {
  const list2 = el("div", "evlist");
  for (const item of items2.slice(0, 3)) {
    const ev = el("div", "ev");
    const top = el("div", "evtop");
    const dot = el("span", "evdot");
    dot.style.color = meta(item.source).color;
    top.append(dot, el("span", "evsrc", meta(item.source).label));
    const c = item.confidenceSignals?.confirmationCount;
    ev.append(top, el("div", "evsum", item.summary ?? item.title ?? ""));
    if (typeof c === "number") ev.append(el("div", "evmeta", `${item.source} \xB7 ${c} confirmation${c === 1 ? "" : "s"}`));
    list2.append(ev);
  }
  return list2;
}
function answerCard(data) {
  const card = el("div", "card glass lux");
  const chips = el("div", "chiprow");
  chips.append(el("span", "chip status" + (data.status === "ok" ? " ok" : ""), (data.status ?? "ok").replace(/_/g, " ")));
  if (data.intent) chips.append(el("span", "chip", data.intent.replace(/_/g, " ")));
  card.append(chips);
  if (data.answer) card.append(el("div", "answer", data.answer));
  card.append(meterEl(data.confidence ?? 0));
  if (data.sourcesUsed?.length) {
    card.append(el("div", "section-label", "Who's seeing it"));
    card.append(pillsEl(data.sourcesUsed));
  }
  if (data.evidence?.length) {
    card.append(el("div", "section-label", "Top evidence"));
    card.append(evidenceEl(data.evidence));
  }
  if (data.followupQuestion) {
    const fu = el("div", "followup");
    fu.append(el("span", "q", "\u2726"), el("span", void 0, data.followupQuestion));
    card.append(fu);
  }
  if (data.privacyNotice) {
    const pv = el("div", "privacy");
    pv.append(el("span", "dot"), el("span", void 0, data.privacyNotice));
    card.append(pv);
  }
  return card;
}
function buildAskView() {
  const view = el("div", "view");
  view.id = "view-ask";
  const composer = el("div", "composer glass");
  const ta = el("textarea");
  ta.placeholder = "Anyone else crashing at the factory boss intro?";
  composer.append(ta);
  const snatchRow = el("div", "snatchrow");
  const snatchBtn = el("button", "btn2", "\u{1F4F8} SnatchIt");
  const snatchStatus = el("span", "snatchstatus", "");
  const snatchTray = el("div", "snatchtray");
  snatchRow.append(snatchBtn, snatchStatus);
  composer.append(snatchRow, snatchTray);
  snatchBtn.addEventListener("click", async () => {
    snatchStatus.textContent = "Drag a box on the page\u2026";
    snatchBtn.disabled = true;
    const res = await snatch();
    snatchBtn.disabled = false;
    if (!res.ok) {
      snatchStatus.textContent = res.reason === "cancelled" ? "Snatch cancelled" : res.reason === "no_permission" ? "Allow capture for this page, then retry" : res.reason === "no_tab" ? "No active tab" : "This page blocked the snatch";
      return;
    }
    snatchStatus.textContent = "Snatched \u2726";
    const chip = el("div", "snatchchip");
    const thumb = el("img", "snatchthumb");
    thumb.src = res.dataUrl;
    thumb.alt = "snatch";
    const del = el("button", "snatchdel", "\u2715");
    del.title = "Remove snatch";
    del.addEventListener("click", () => {
      chip.remove();
      if (!snatchTray.childElementCount) snatchStatus.textContent = "";
    });
    chip.append(thumb, del);
    snatchTray.append(chip);
  });
  composer.append(el("div", "section-label", "Send to"));
  const targets = el("div", "targets");
  const savedTargets = getTargets(connected2.map((s) => s.source));
  const selected = new Set(savedTargets.filter((t) => connected2.some((s) => s.source === t)));
  for (const s of connected2) {
    const chip = el("button", "target");
    chip.setAttribute("aria-pressed", String(selected.has(s.source)));
    chip.style.setProperty("--tc", meta(s.source).color);
    const led = el("span", "led");
    led.style.color = meta(s.source).color;
    chip.append(led, document.createTextNode(meta(s.source).label));
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      if (on) selected.delete(s.source);
      else selected.add(s.source);
      setTargets([...selected]);
    });
    targets.append(chip);
  }
  composer.append(targets);
  const bbar = el("div", "bbar");
  const checkBtn = el("button", "btn2 go");
  checkBtn.textContent = "Check who else \u2726";
  const blastBtn = el("button", "btn2");
  blastBtn.textContent = "Queue broadcast";
  bbar.append(checkBtn, blastBtn);
  composer.append(bbar);
  const out = el("div", "viewscroll");
  view.append(composer, out);
  const targetList = () => [...selected];
  checkBtn.addEventListener("click", async () => {
    const message = ta.value.trim();
    if (!message) {
      ta.focus();
      return;
    }
    const sel = targetList();
    if (!sel.length) return;
    checkBtn.disabled = true;
    out.innerHTML = "";
    const loading = el("div", "card glass lux");
    loading.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
    out.append(loading);
    try {
      const ctx = { ...workspace, connectedSources: workspace.connectedSources.filter((s) => selected.has(s.source)) };
      const data = await communityHelp({ userMessage: message, mode: "community_manager", sourcePolicy: "use_connected_sources_only" }, ctx, sel.map(adapterFor));
      out.innerHTML = "";
      const local = localConfirmations(message);
      if (local.count > 0) {
        const corr = el("div", "corr");
        corr.append(el("span", "spark", "\u2726"));
        const txt = el("span");
        txt.append(document.createTextNode("You confirmed this "));
        txt.append(el("b", void 0, `${local.count}\xD7`));
        txt.append(document.createTextNode(` from the feed across ${local.sources.map((s) => meta(s).label).join(", ")} \u2014 raising prevalence.`));
        corr.append(txt);
        out.append(corr);
      }
      out.append(answerCard(data));
    } finally {
      checkBtn.disabled = false;
    }
  });
  blastBtn.addEventListener("click", () => {
    const message = ta.value.trim();
    if (!message) {
      ta.focus();
      return;
    }
    const sel = targetList();
    if (!sel.length) return;
    out.innerHTML = "";
    const card = el("div", "card glass lux");
    card.append(el("div", "section-label", `Queued ${sel.length} draft${sel.length === 1 ? "" : "s"} \u2014 review & approve in the Queue tab`));
    const listEl = el("div", "queued");
    const intent = classifyIntent(message);
    for (const kind of sel) {
      const draft = composeDraft({ kind: "poll", source: kind, topic: message, intent });
      enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body, tone: "auto", recompose: { kind: "poll", topic: message, intent } });
      const row = el("div", "qrow");
      const led = el("span", "qled");
      led.style.color = meta(kind).color;
      row.append(led, el("span", void 0, `Poll \u2192 ${meta(kind).label}`), el("span", "qstate", "Approval"));
      listEl.append(row);
    }
    card.append(listEl);
    const cta = el("button", "btn2 go");
    cta.textContent = `Review in Queue (${pendingCount()})`;
    cta.addEventListener("click", () => setActive("queue"));
    card.append(cta);
    out.append(card);
  });
  return view;
}
var feedEls = {};
function renderMsg(m, kind, live = false, showSource = false) {
  const row = el("div", live ? "msg in" : "msg");
  const av = el("div", "av", m.author.charAt(0).toUpperCase());
  av.style.background = meta(kind).color;
  const mb = el("div", "mb");
  const mh = el("div", "mh");
  const sd = el("span", "sdot");
  sd.style.background = SENT[m.sentiment];
  mh.append(sd, el("span", "mn", m.author), el("span", "role", m.role));
  if (showSource) {
    const sb = el("span", "src", meta(kind).label);
    sb.style.background = meta(kind).color;
    mh.append(sb);
  }
  mh.append(el("span", "mt", m.ago));
  mb.append(mh, el("div", "mtext", m.body));
  const react = el("div", "react");
  let up = m.up;
  const upBtn = el("button", "rbtn", `\u25B2 ${up}`);
  const meBtn = el("button", "rbtn", "+ me too");
  meBtn.addEventListener("click", () => {
    if (meBtn.classList.contains("done")) return;
    up += 1;
    upBtn.textContent = `\u25B2 ${up}`;
    meBtn.className = "rbtn done";
    meBtn.textContent = "\u2713 me too";
    addSignal(m.body, kind);
  });
  const replyBtn = el("button", "rbtn", "Draft reply");
  replyBtn.addEventListener("click", () => {
    if (replyBtn.classList.contains("queued")) return;
    const draft = composeDraft({
      kind: "reply",
      source: kind,
      topic: m.body,
      intent: classifyIntent(m.body),
      evidence: [{ id: m.author, source: kind, title: m.author, summary: m.body, matchedTerms: [], confidenceSignals: { semanticMatch: 0.6, exactTermMatch: 0.5, recency: 0.9, sourceTrust: 0.6, confirmationCount: m.up, sameVersionBonus: 0, resolvedBonus: 0, duplicatePenalty: 0, lowQualityPenalty: 0 }, redacted: true }]
    });
    enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body, tone: "auto", recompose: { kind: "reply", topic: m.body, intent: classifyIntent(m.body) } });
    replyBtn.className = "rbtn queued";
    replyBtn.textContent = "Queued \xB7 approval";
  });
  react.append(upBtn, meBtn, replyBtn);
  mb.append(react);
  row.append(av, mb);
  return row;
}
function buildSourceView(cap) {
  const kind = cap.source;
  const m = meta(kind);
  const view = el("div", "view");
  view.id = `view-${kind}`;
  const head = el("div", "card glass");
  const hr = el("div", "srchead");
  const dot = el("span", "sdot");
  dot.style.color = m.color;
  hr.append(dot, el("span", "sname", m.label), el("span", "sreach", cap.write === "disabled" ? "read-only" : "approval-gated"));
  head.append(hr);
  const caps = el("div", "caps");
  caps.append(el("span", "cap on", "read"));
  caps.append(el("span", cap.write === "disabled" ? "cap off" : "cap warn", `write: ${cap.write.replace(/_/g, " ")}`));
  if (cap.supportsRealtime) caps.append(el("span", "cap", "realtime"));
  if (cap.supportsThreads) caps.append(el("span", "cap", "threads"));
  head.append(caps);
  if (cap.approvedSpaces?.length) {
    const spaces = el("div", "pills");
    for (const s of cap.approvedSpaces) spaces.append(el("span", "pill", "#" + s));
    head.append(spaces);
  }
  const fhead = el("div", "feedhead");
  const live = el("span", "live");
  live.append(el("span", "pulse"), document.createTextNode("Demo"));
  fhead.append(el("span", "section-label", `${m.label} community feed`), live);
  const feed = el("div", "feed");
  for (const msg of recentFor(kind)) feed.append(renderMsg(msg, kind));
  feedEls[kind] = feed;
  if (kind in SITE_INFO) {
    const bar = el("div", "livebar");
    const status = el("span", "livestatus", "");
    const btn = el("button", "btn2 go", "Read this page \u2726");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      status.textContent = "Reading\u2026";
      if (!isConnected(kind)) {
        const ok = await connect(kind);
        if (!ok) {
          status.textContent = "Connect declined";
          btn.disabled = false;
          return;
        }
      }
      const res = await readActiveTab();
      btn.disabled = false;
      if (!res.ok) {
        status.textContent = res.reason === "not_on_site" ? `Open a ${m.label} tab, then read` : res.reason === "no_permission" ? "Not connected yet" : res.reason === "blocked" ? "Page blocked the read" : "No active tab";
        return;
      }
      if (res.site !== kind) {
        status.textContent = `That tab is ${SITE_INFO[res.site]?.label ?? res.site}, not ${m.label}`;
        return;
      }
      feed.innerHTML = "";
      if (!res.messages.length) {
        status.textContent = "No messages found on this page";
        return;
      }
      for (const sm of res.messages) feed.append(renderMsg({ author: sm.author, role: "player", body: sm.body, ago: sm.ago || "now", sentiment: "neu", up: 0 }, kind, false));
      live.innerHTML = "";
      live.append(el("span", "pulse"), document.createTextNode("Live"));
      status.textContent = `${res.messages.length} live messages from your ${m.label} session`;
    });
    bar.append(btn, status);
    view.append(head, bar, fhead, feed);
  } else {
    view.append(head, fhead, feed);
  }
  return view;
}
var pulseFeed = null;
var pulseRotor = connected2.map((s) => ({ kind: s.source }));
var pulseTick = 0;
function buildPulseView() {
  const view = el("div", "view");
  view.id = "view-pulse";
  const head = el("div", "pulsehead");
  const live = el("span", "live");
  live.append(el("span", "pulse"), document.createTextNode("Live"));
  head.append(el("span", "section-label", "Pulse \xB7 every connected source, interleaved"), live);
  const feed = el("div", "feed");
  const seed = connected2.map((s) => ({ kind: s.source, msg: recentFor(s.source)[0] }));
  for (const s of seed) feed.append(renderMsg(s.msg, s.kind, false, true));
  pulseFeed = feed;
  view.append(head, feed);
  return view;
}
var ACTION_LABEL = { reply: "Reply", poll: "Poll", known_issue: "Known Issue", faq: "FAQ", announcement: "Announcement" };
function renderQueue(container) {
  container.innerHTML = "";
  const items2 = list();
  if (items2.length === 0) {
    const empty = el("div", "queue-empty");
    empty.append(el("span", "big", "\u270E"), document.createTextNode("No drafts yet. Use \u201CDraft reply\u201D on a feed message, or \u201CQueue broadcast\u201D in Ask \u2014 they land here for your approval."));
    container.append(empty);
    return;
  }
  const resolved = items2.filter((i) => i.status !== "queued").length;
  if (resolved > 0) {
    const bar = el("div", "qclearbar");
    const clear = el("button", "dbtn", `Clear ${resolved} resolved`);
    clear.addEventListener("click", () => clearResolved());
    bar.append(clear);
    container.append(bar);
  }
  for (const item of items2) renderDraftCard(container, item);
}
function renderDraftCard(container, item) {
  const card = el("div", "draft card glass lux");
  const dh = el("div", "dh");
  const kind = el("span", "dkind", ACTION_LABEL[item.actionType] ?? item.actionType);
  kind.style.background = meta(item.source).color;
  const src = el("span", "dsrc");
  const led = el("span", "led");
  led.style.color = meta(item.source).color;
  src.append(led, document.createTextNode(meta(item.source).label));
  const state = el("span", `dstate ${item.status}`, item.status);
  dh.append(kind, src, state);
  card.append(dh);
  if (item.title) card.append(el("div", "dtitle", item.title));
  const body = el("textarea", "dbody");
  body.value = item.body;
  body.disabled = item.status !== "queued";
  body.addEventListener("input", () => updateBody(item.id, body.value));
  card.append(body);
  if (item.status === "queued" && item.recompose) {
    const tr = el("div", "tonerow");
    tr.append(el("span", "tonelabel", "Tone"));
    const sel = el("select", "toneselect");
    for (const [v, label] of [["auto", "Native voice"], ["friendly", "Friendly"], ["official", "Official"], ["technical", "Technical"], ["casual", "Casual"]]) {
      const o = el("option");
      o.value = v;
      o.textContent = label;
      if ((item.tone ?? "auto") === v) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", () => {
      const rc = item.recompose;
      const d = composeDraft({ kind: rc.kind, source: item.source, topic: rc.topic, intent: rc.intent, tone: sel.value });
      applyEdit(item.id, { body: d.body, tone: sel.value });
    });
    tr.append(sel);
    card.append(tr);
  }
  if (item.status === "queued") {
    const actions = el("div", "dactions");
    const approve = el("button", "dbtn approve", "\u2713 Approve");
    approve.addEventListener("click", () => setStatus(item.id, "approved"));
    const reject = el("button", "dbtn reject", "Reject");
    reject.addEventListener("click", () => setStatus(item.id, "rejected"));
    const copy = el("button", "dbtn copy", "Copy");
    copy.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(body.value).catch(() => {
      });
      copy.textContent = "Copied \u2713";
      window.setTimeout(() => copy.textContent = "Copy", 1500);
    });
    actions.append(approve, reject, copy);
    card.append(actions);
  } else {
    const row = el("div", "dactions");
    if (item.status === "approved") {
      const pv = el("div", "privacy");
      pv.append(el("span", "dot"), el("span", void 0, "Approved \u2014 paste into the client to post. Help Me never posts on its own."));
      card.append(pv);
    }
    const del = el("button", "dbtn", "Remove");
    del.addEventListener("click", () => remove(item.id));
    row.append(del);
    card.append(row);
  }
  container.append(card);
}
function buildQueueView() {
  const view = el("div", "view");
  view.id = "view-queue";
  view.append(el("div", "section-label", "Approval queue \xB7 nothing posts until you approve"));
  const body = el("div", "result");
  queueBody = body;
  renderQueue(body);
  view.append(body);
  return view;
}
var nav = document.getElementById("nav");
var indicator = document.getElementById("ind");
var views = document.getElementById("views");
var CUSTOM_COLORS = ["#4cc2ff", "#7d88c8", "#e0964a", "#2ee06a", "#66c0f4", "#c9d1d9"];
function buildCustomFeedView(cs) {
  const view = el("div", "view");
  view.id = `view-${cs.id}`;
  const head = el("div", "card glass");
  const hr = el("div", "srchead");
  const dot = el("span", "sdot");
  dot.style.color = cs.color;
  hr.append(dot, el("span", "sname", cs.label), el("span", "sreach", cs.type));
  head.append(hr, el("div", "addhint", cs.url));
  const feed = el("div", "feed");
  feed.append(el("div", "addhint", "Loading\u2026"));
  view.append(head, feed);
  const adapter = new CustomSourceAdapter({ id: cs.id, label: cs.label, type: cs.type, url: cs.url });
  adapter.getThread({ source: "forum", externalId: cs.id }, workspace).then((thread) => {
    feed.innerHTML = "";
    if (!thread.items.length) {
      feed.append(el("div", "addhint", "No items yet (or the source blocked the request from the browser)."));
      return;
    }
    for (const it of thread.items.slice(0, 12)) {
      feed.append(renderMsg({ author: cs.label, role: "player", body: it.body, ago: "", sentiment: "neu", up: 0 }, "forum", false));
    }
  }).catch(() => {
    feed.innerHTML = "";
    feed.append(el("div", "addhint", "Couldn't reach that source from the browser."));
  });
  return view;
}
function buildAddView() {
  const view = el("div", "view");
  view.id = "view-add";
  const form = el("div", "addform card glass");
  form.append(el("div", "section-label", "Add a custom source"));
  const nameWrap = el("div");
  nameWrap.append(el("label", void 0, "Name"));
  const name = el("input");
  name.placeholder = "My Game Forum";
  nameWrap.append(name);
  const row = el("div", "row2");
  const typeWrap = el("div");
  typeWrap.append(el("label", void 0, "Type"));
  const type = el("select");
  for (const [v, t] of [["discourse", "Discourse forum"], ["rss", "RSS / Atom feed"]]) {
    const o = el("option");
    o.value = v;
    o.textContent = t;
    type.append(o);
  }
  typeWrap.append(type);
  const colorWrap = el("div");
  colorWrap.append(el("label", void 0, "Accent"));
  const color = el("select");
  for (const c of CUSTOM_COLORS) {
    const o = el("option");
    o.value = c;
    o.textContent = c;
    color.append(o);
  }
  colorWrap.append(color);
  row.append(typeWrap, colorWrap);
  const urlWrap = el("div");
  urlWrap.append(el("label", void 0, "URL"));
  const url = el("input");
  url.placeholder = "https://forum.mygame.com  or  https://site.com/feed.xml";
  urlWrap.append(url);
  const add = el("button", "primary");
  add.textContent = "Add source \u2726";
  add.addEventListener("click", () => {
    const label = name.value.trim();
    const u = url.value.trim();
    if (!label || !u) {
      (label ? url : name).focus();
      return;
    }
    addCustom({ label, type: type.value, url: u, color: color.value });
    name.value = "";
    url.value = "";
  });
  form.append(nameWrap, row, urlWrap, add);
  form.append(el("div", "addhint", "Discourse forums expose a public JSON API. RSS/Atom works for devlogs, patch-note feeds, and many forums. Read-only \u2014 nothing is ever posted. Some sites may block browser requests (CORS); those still work via the team app / MCP."));
  view.append(form);
  const mine = el("div", "result");
  const renderMine = () => {
    mine.innerHTML = "";
    const all = listCustom();
    if (!all.length) return;
    mine.append(el("div", "section-label", "Your sources"));
    for (const cs of all) {
      const r = el("div", "mysrc");
      const led = el("span", "led");
      led.style.color = cs.color;
      const meta2 = el("div");
      meta2.append(el("div", "mn", cs.label), el("div", "mu", `${cs.type} \xB7 ${cs.url}`));
      const rm = el("button", "dbtn rm", "Remove");
      rm.addEventListener("click", () => removeCustom(cs.id));
      r.append(led, meta2, rm);
      mine.append(r);
    }
  };
  renderMine();
  onCustomChange(renderMine);
  view.append(mine);
  return view;
}
var navItems = [];
var navButtons = [];
var WRENCH_STATIONS = [FOTW_STATION, MOD_STATION, DEF_STATION, MYNE_STATION];
var wrenchBridges = createMockWrenchBridges();
var rackThreadHost = null;
function buildRackView() {
  const view = el("div", "view");
  view.id = "view-rack";
  const rack = el("div", "rack");
  rack.append(el("div", "section-label", "Your wrenches \xB7 pair the ones you run"));
  const pegboard = el("div", "pegboard");
  for (const st of WRENCH_STATIONS) {
    const card = el("button", "wrenchcard");
    card.style.setProperty("--wc", st.color);
    card.setAttribute("aria-pressed", String(isPaired(st.id)));
    card.setAttribute("data-available", String(st.available));
    const name = el("div", "wname");
    const ico = el("div", "wico", st.label.charAt(0));
    ico.style.background = st.color;
    name.append(ico, document.createTextNode(st.label));
    card.append(name, el("div", "wtag", st.tagline));
    const state = el("div", `wstate ${isPaired(st.id) ? "on" : "off"}`, st.id === "fotw" ? "cockpit" : isPaired(st.id) ? "paired" : "tap to pair");
    card.append(state);
    card.addEventListener("click", () => {
      togglePair(st.id);
      card.setAttribute("aria-pressed", String(isPaired(st.id)));
      state.className = `wstate ${isPaired(st.id) ? "on" : "off"}`;
      state.textContent = st.id === "fotw" ? "cockpit" : isPaired(st.id) ? "paired" : "tap to pair";
    });
    pegboard.append(card);
  }
  rack.append(pegboard);
  rack.append(el("div", "section-label", "Cross-wrench thread"));
  const composer = el("div", "composer glass");
  const ta = el("textarea");
  ta.placeholder = "What are you chasing? e.g. 'crashing at the factory boss'";
  const bar = el("div", "composer-bar");
  bar.append(el("span", "hint", "Threads one story across your paired wrenches"));
  const btn = el("button", "primary", "Thread it \u2726");
  bar.append(btn);
  composer.append(ta, bar);
  const threadHost = el("div", "result");
  rackThreadHost = threadHost;
  threadHost.append(emptyThread());
  btn.addEventListener("click", async () => {
    const topic = ta.value.trim();
    if (!topic) {
      ta.focus();
      return;
    }
    btn.disabled = true;
    threadHost.innerHTML = "";
    const loading = el("div", "card glass lux");
    loading.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
    threadHost.append(loading);
    try {
      const paired2 = new Set(listPaired());
      const help = await communityHelp({ userMessage: topic, sourcePolicy: "auto_scope_connected_sources" }, workspace, allAdapters);
      const fotwBridge = {
        id: "fotw",
        station: FOTW_STATION,
        findings: async () => help.evidence?.length ? [{ wrench: "fotw", kind: "community_signal", title: "Community signal", detail: `${help.answer.split("\n")[0]} (${Math.round((help.confidence ?? 0) * 100)}% across ${help.sourcesUsed.join(", ")})`, weight: help.confidence ?? 0.5 }] : []
      };
      const stationFor = (id) => WRENCH_STATIONS.find((s) => s.id === id) ?? FOTW_STATION;
      const live = await liveHelperBridges(stationFor);
      const wrenchSet = (live ?? wrenchBridges).filter((b) => paired2.has(b.id));
      const active = [fotwBridge, ...wrenchSet];
      const thread = await correlate(topic, active);
      threadHost.innerHTML = "";
      if (live) threadHost.append(el("div", "tlead", "\u25CF Live \u2014 threaded from your local wrenches"));
      threadHost.append(renderThread(thread));
    } finally {
      btn.disabled = false;
    }
  });
  rack.append(composer, threadHost);
  view.append(rack);
  return view;
}
function emptyThread() {
  const e = el("div", "emptythread");
  e.append(document.createTextNode("Pair your wrenches above, then thread a topic. FOTW\xB2 brings the community signal; ModWrench the likely cause; DefWrench the fix; MyneWrench the impact \u2014 one story, not six screens."));
  return e;
}
var WSTATION = {
  fotw: { label: "FOTW\xB2", color: "#7d88c8" },
  mod: { label: "ModWrench", color: "#4cc2ff" },
  def: { label: "DefWrench", color: "#e0964a" },
  myne: { label: "MyneWrench", color: "#2ee06a" }
};
function renderThread(thread) {
  const card = el("div", "thread card glass lux");
  if (!thread.findings.length) {
    card.append(emptyThread());
    return card;
  }
  card.append(el("div", "tlead", `\u201C${thread.topic}\u201D \u2014 threaded across ${thread.contributors.length} wrench${thread.contributors.length === 1 ? "" : "es"}`));
  card.append(meterEl(thread.confidence));
  const chain = el("div", "chain");
  for (const f of thread.findings) {
    const ws = WSTATION[f.wrench] ?? { label: f.wrench, color: "#9aa6c4" };
    const link = el("div", "link");
    link.style.setProperty("--lc", ws.color);
    const node = el("div", "lnode", ws.label.charAt(0));
    node.style.background = ws.color;
    const body = el("div", "lbody");
    body.append(el("div", "lwrench", ws.label), el("div", "ltitle", f.title), el("div", "ldetail", f.detail));
    if (f.ref) body.append(el("span", "lref", f.ref));
    link.append(node, body);
    chain.append(link);
  }
  card.append(chain);
  return card;
}
function buildSettingsView() {
  const view = el("div", "view");
  view.id = "view-settings";
  const card = el("div", "addform card glass");
  card.append(el("div", "section-label", "Settings"));
  const s = getSettings();
  const trickWrap = el("div", "setrow");
  const trickLabel = el("label", void 0, "Live feed trickle");
  const trick = el("select", "toneselect");
  for (const [v, label] of [["on", "On"], ["off", "Off"]]) {
    const o = el("option");
    o.value = v;
    o.textContent = label;
    if ((s.trickle ? "on" : "off") === v) o.selected = true;
    trick.append(o);
  }
  trick.addEventListener("change", () => setSettings({ trickle: trick.value === "on" }));
  trickWrap.append(trickLabel, trick);
  const speedWrap = el("div", "setrow");
  const speedLabel = el("label", void 0, "Feed speed");
  const speed = el("select", "toneselect");
  for (const [v, label] of [["2500", "Fast"], ["4500", "Normal"], ["8000", "Slow"]]) {
    const o = el("option");
    o.value = v;
    o.textContent = label;
    if (String(s.trickleMs) === v) o.selected = true;
    speed.append(o);
  }
  speed.addEventListener("change", () => setSettings({ trickleMs: Number(speed.value) }));
  speedWrap.append(speedLabel, speed);
  card.append(trickWrap, speedWrap);
  const helper = getHelper();
  card.append(el("div", "section-label", "Local helper (Rack \u2194 your wrenches)"));
  const hUrl = el("input", "toneselect");
  hUrl.placeholder = "http://127.0.0.1:7717";
  hUrl.value = helper?.url ?? "";
  hUrl.style.width = "100%";
  const hTok = el("input", "toneselect");
  hTok.placeholder = "helper token (printed when you start it)";
  hTok.value = helper?.token ?? "";
  hTok.style.width = "100%";
  const hStatus = el("div", "addhint", helper ? "saved \u2014 open the Rack and Thread it to go live" : "not connected \u2014 Rack uses demo wrench data");
  const hSave = el("button", "dbtn", "Save helper");
  hSave.addEventListener("click", async () => {
    setHelper(hUrl.value.trim(), hTok.value.trim());
    hStatus.textContent = "Checking\u2026";
    const live = await liveHelperBridges(() => FOTW_STATION);
    hStatus.textContent = live ? `\u25CF connected \u2014 ${live.length} wrench${live.length === 1 ? "" : "es"} reachable` : "saved, but helper not reachable yet (start it, then re-save)";
  });
  const hRow = el("div", "addform");
  hRow.append(hUrl, hTok, hSave, hStatus);
  card.append(hRow);
  const danger = el("div", "addform");
  danger.append(el("div", "section-label", "Data"));
  const clearQ = el("button", "dbtn", "Clear all drafts");
  clearQ.addEventListener("click", () => {
    list().slice().forEach((q) => remove(q.id));
  });
  const clearAll = el("button", "dbtn reject", "Reset everything (drafts, sources, prefs)");
  clearAll.addEventListener("click", () => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) chrome.storage.local.clear(() => location.reload());
  });
  danger.append(clearQ, clearAll);
  danger.append(el("div", "addhint", "Stored data is local to this browser: your drafts, custom sources, target picks, and settings. No tokens or fetched messages are ever stored."));
  view.append(card, danger);
  return view;
}
function rebuildNav() {
  const custom = listCustom();
  navItems = [
    { id: "ask", label: "Ask", accent: "#4cc2ff" },
    { id: "rack", label: "Rack", accent: "#7d88c8" },
    { id: "pulse", label: "Pulse", accent: "#2ee06a" },
    ...connected2.map((s) => ({ id: s.source, label: meta(s.source).label, accent: meta(s.source).color })),
    ...custom.map((c) => ({ id: c.id, label: c.label, accent: c.color })),
    { id: "queue", label: "Queue", accent: "#e0964a" },
    { id: "add", label: "+ Add", accent: "#7d88c8" },
    { id: "settings", label: "\u2699", accent: "#9aa6c4" }
  ];
  views.innerHTML = "";
  views.append(
    buildAskView(),
    buildRackView(),
    buildPulseView(),
    ...connected2.map((s) => buildSourceView(s)),
    ...custom.map((c) => buildCustomFeedView(c)),
    buildQueueView(),
    buildAddView(),
    buildSettingsView()
  );
  nav.querySelectorAll(".tab").forEach((b) => b.remove());
  navButtons = navItems.map((item) => {
    const b = el("button", "tab");
    b.dataset.tab = item.id;
    b.dataset.accent = item.accent;
    b.style.setProperty("--a", item.accent);
    b.append(el("span", "led"), document.createTextNode(item.label));
    b.addEventListener("click", () => setActive(item.id));
    nav.append(b);
    return b;
  });
  refreshQueueBadge();
}
function refreshQueueBadge() {
  const queueBtn = navButtons.find((b) => b.dataset.tab === "queue");
  if (!queueBtn) return;
  queueBtn.querySelector(".badge")?.remove();
  const n = pendingCount();
  if (n > 0) queueBtn.append(el("span", "badge", String(n)));
}
onChange(() => {
  refreshQueueBadge();
  if (activeView === "queue" && queueBody) renderQueue(queueBody);
});
function setActive(id) {
  const btn = navButtons.find((b) => b.dataset.tab === id);
  if (!btn) return;
  navButtons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
  nav.style.setProperty("--tab-accent", btn.dataset.accent ?? "#4cc2ff");
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  indicator.style.width = `${btn.offsetWidth}px`;
  btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  views.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id}`));
  activeView = id;
  setLastTab(id);
  if (id === "queue" && queueBody) renderQueue(queueBody);
}
var trickleTimer;
function trickleTick() {
  if (!getSettings().trickle) return;
  if (activeView === "pulse" && pulseFeed) {
    const kind = pulseRotor[pulseTick++ % pulseRotor.length].kind;
    pulseFeed.prepend(renderMsg(liveFor(kind), kind, true, true));
    while (pulseFeed.childElementCount > 16) pulseFeed.lastElementChild?.remove();
    return;
  }
  const feed = feedEls[activeView];
  if (!feed) return;
  feed.prepend(renderMsg(liveFor(activeView), activeView, true));
  while (feed.childElementCount > 14) feed.lastElementChild?.remove();
}
function scheduleTrickle() {
  if (trickleTimer !== void 0) window.clearInterval(trickleTimer);
  trickleTimer = window.setInterval(trickleTick, getSettings().trickleMs);
}
onSettingsChange(scheduleTrickle);
Promise.all([hydrate(), hydratePrefs(), hydrateCustom(), hydrateSettings(), hydrateConnections(), hydrateRack(), hydrateHelper()]).then(() => {
  scheduleTrickle();
  rebuildNav();
  if (queueBody) renderQueue(queueBody);
  const last = getLastTab();
  const validTabs = new Set(navItems.map((n) => n.id));
  requestAnimationFrame(() => setActive(last && validTabs.has(last) ? last : "ask"));
});
onCustomChange(() => {
  const current = activeView;
  rebuildNav();
  const validTabs = new Set(navItems.map((n) => n.id));
  setActive(validTabs.has(current) ? current : "add");
});
window.addEventListener("resize", () => {
  const cur = navButtons.find((b) => b.getAttribute("aria-selected") === "true");
  if (cur) {
    indicator.style.transform = `translateX(${cur.offsetLeft}px)`;
    indicator.style.width = `${cur.offsetWidth}px`;
  }
});
