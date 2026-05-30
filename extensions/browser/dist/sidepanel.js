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
  const connected2 = new Set(context.connectedSources.filter((s) => s.read).map((s) => s.source));
  const onlyConnected = (sources) => sources.filter((source) => connected2.has(source));
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
function rankEvidence(items) {
  return [...items].sort((a, b) => scoreEvidence(b) - scoreEvidence(a));
}
function aggregateConfidence(items) {
  if (items.length === 0)
    return 0;
  const top = rankEvidence(items).slice(0, 5);
  const avg = top.reduce((sum, item) => sum + scoreEvidence(item), 0) / top.length;
  return Math.max(0, Math.min(1, avg));
}

// ../../packages/core/dist/privacyRedactor.js
function privacyNotice(retention) {
  return retention === "ephemeral" ? "Scoped evidence was used for this task and should be discarded by MCP-owned storage after the response." : "Workspace is configured for user-owned retention; MCP-owned storage should still avoid sensitive bodies.";
}

// ../../packages/core/dist/actions.js
function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function createActionPlan(input) {
  return {
    actionId: id("act"),
    actionType: input.actionType,
    targetRef: input.targetRef,
    targetSummary: input.targetSummary,
    draft: input.draft,
    approvalRequired: true,
    clientActions: [
      {
        type: "present_for_user_approval",
        allowedClient: input.allowedClient ?? "web_app",
        requiresVisibleUserConfirmation: true
      }
    ],
    evidenceRefs: input.evidenceRefs ?? [],
    status: "drafted"
  };
}
function queueAction(plan) {
  return {
    ...plan,
    approvalRequired: true,
    status: "queued"
  };
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
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    stage.style.setProperty("--ry", (cx * 6).toFixed(2) + "deg");
    stage.style.setProperty("--rx", (-cy * 6).toFixed(2) + "deg");
    root.style.setProperty("--px", (cx * -16).toFixed(1) + "px");
    root.style.setProperty("--py", (cy * -16).toFixed(1) + "px");
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

// src/sidepanel.ts
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
var connected = workspace.connectedSources.filter((s) => s.read);
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
function pillsEl(sources) {
  const pills = el("div", "pills");
  for (const s of sources) {
    const pill = el("span", "pill");
    const led = el("span", "led");
    led.style.color = meta(s).color;
    pill.append(led, document.createTextNode(meta(s).label));
    pills.append(pill);
  }
  return pills;
}
function evidenceEl(items) {
  const list = el("div", "evlist");
  for (const item of items.slice(0, 3)) {
    const ev = el("div", "ev");
    const top = el("div", "evtop");
    const dot = el("span", "evdot");
    dot.style.color = meta(item.source).color;
    top.append(dot, el("span", "evsrc", meta(item.source).label));
    const c = item.confidenceSignals?.confirmationCount;
    ev.append(top, el("div", "evsum", item.summary ?? item.title ?? ""));
    if (typeof c === "number") ev.append(el("div", "evmeta", `${item.source} \xB7 ${c} confirmation${c === 1 ? "" : "s"}`));
    list.append(ev);
  }
  return list;
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
  composer.append(el("div", "section-label", "Send to"));
  const targets = el("div", "targets");
  const selected = new Set(connected.map((s) => s.source));
  for (const s of connected) {
    const chip = el("button", "target");
    chip.setAttribute("aria-pressed", "true");
    chip.style.setProperty("--tc", meta(s.source).color);
    const led = el("span", "led");
    led.style.color = meta(s.source).color;
    chip.append(led, document.createTextNode(meta(s.source).label));
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      if (on) selected.delete(s.source);
      else selected.add(s.source);
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
    card.append(el("div", "section-label", `Queued to ${sel.length} target${sel.length === 1 ? "" : "s"} \u2014 nothing posts until you approve`));
    const list = el("div", "queued");
    for (const kind of sel) {
      const plan = queueAction(createActionPlan({ actionType: "poll", draft: message, targetRef: kind, allowedClient: "web_app" }));
      const row = el("div", "qrow");
      const led = el("span", "qled");
      led.style.color = meta(kind).color;
      row.append(led, el("span", void 0, `Poll \u2192 ${meta(kind).label}`), el("span", "qstate", plan.approvalRequired ? "Approval" : plan.status));
      list.append(row);
    }
    card.append(list);
    const pv = el("div", "privacy");
    pv.append(el("span", "dot"), el("span", void 0, "Drafts are queued locally. Approve each in the client to post."));
    card.append(pv);
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
    queueAction(createActionPlan({ actionType: "reply", draft: "(reply draft)", targetRef: kind, allowedClient: "web_app" }));
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
  live.append(el("span", "pulse"), document.createTextNode("Live"));
  fhead.append(el("span", "section-label", `${m.label} community feed`), live);
  const feed = el("div", "feed");
  for (const msg of recentFor(kind)) feed.append(renderMsg(msg, kind));
  feedEls[kind] = feed;
  view.append(head, fhead, feed);
  return view;
}
var pulseFeed = null;
var pulseRotor = connected.map((s) => ({ kind: s.source }));
var pulseTick = 0;
function buildPulseView() {
  const view = el("div", "view");
  view.id = "view-pulse";
  const head = el("div", "pulsehead");
  const live = el("span", "live");
  live.append(el("span", "pulse"), document.createTextNode("Live"));
  head.append(el("span", "section-label", "Pulse \xB7 every connected source, interleaved"), live);
  const feed = el("div", "feed");
  const seed = connected.map((s) => ({ kind: s.source, msg: recentFor(s.source)[0] }));
  for (const s of seed) feed.append(renderMsg(s.msg, s.kind, false, true));
  pulseFeed = feed;
  view.append(head, feed);
  return view;
}
var nav = document.getElementById("nav");
var indicator = document.getElementById("ind");
var views = document.getElementById("views");
var navItems = [
  { id: "ask", label: "Ask", accent: "#4cc2ff" },
  { id: "pulse", label: "Pulse", accent: "#2ee06a" },
  ...connected.map((s) => ({ id: s.source, label: meta(s.source).label, accent: meta(s.source).color }))
];
views.append(buildAskView(), buildPulseView(), ...connected.map((s) => buildSourceView(s)));
var navButtons = navItems.map((item) => {
  const b = el("button", "tab");
  b.dataset.tab = item.id;
  b.dataset.accent = item.accent;
  b.style.setProperty("--a", item.accent);
  b.append(el("span", "led"), document.createTextNode(item.label));
  b.addEventListener("click", () => setActive(item.id));
  nav.append(b);
  return b;
});
var activeView = "ask";
function setActive(id2) {
  const btn = navButtons.find((b) => b.dataset.tab === id2);
  if (!btn) return;
  navButtons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
  nav.style.setProperty("--tab-accent", btn.dataset.accent ?? "#4cc2ff");
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  indicator.style.width = `${btn.offsetWidth}px`;
  btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  views.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id2}`));
  activeView = id2;
}
window.setInterval(() => {
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
}, 4500);
requestAnimationFrame(() => setActive("ask"));
window.addEventListener("resize", () => {
  const cur = navButtons.find((b) => b.getAttribute("aria-selected") === "true");
  if (cur) {
    indicator.style.transform = `translateX(${cur.offsetLeft}px)`;
    indicator.style.width = `${cur.offsetWidth}px`;
  }
});
