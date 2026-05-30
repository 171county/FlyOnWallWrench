import {
  aggregateConfidence,
  classifyIntent,
  communityHelp,
  composeDraft,
  mockWorkspaceContext,
  rankEvidence,
  type DraftKind,
  type EvidenceItem,
  type HelpAnswer,
  type SourceCapabilities,
  type SourceKind,
} from "@help-me-comms/core";
import { BaseMockAdapter, createDefaultMockAdapters } from "@help-me-comms/adapters";
import { initShaderBackground } from "./shaderBg";
import { initParallax } from "./spatial";
import { liveFor, recentFor, type FeedMsg } from "./feed";
import { addSignal, localConfirmations } from "./signals";
import { enqueue, list as queueList, onChange as onQueueChange, pendingCount, setStatus, updateBody, type QueueItem } from "./queue";

initShaderBackground("bg");
initParallax();

const SOURCE_META: Record<string, { label: string; color: string }> = {
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
  matrix: { label: "Matrix", color: "#0dbd8b" },
};
const meta = (s: string) => SOURCE_META[s] ?? { label: s, color: "#9aa6c4" };
const SENT: Record<FeedMsg["sentiment"], string> = { pos: "#2ee06a", neu: "#7d88c8", neg: "#ff7a3c", mixed: "#e0964a" };

const workspace = mockWorkspaceContext;
const allAdapters = createDefaultMockAdapters();
const adapterFor = (kind: SourceKind) => allAdapters.find((a) => a.kind === kind) ?? new BaseMockAdapter(kind);
const connected = workspace.connectedSources.filter((s) => s.read);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- shared result pieces ---------- */
function meterEl(value: number): HTMLElement {
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
function pillsEl(sources: string[]): HTMLElement {
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
function evidenceEl(items: EvidenceItem[]): HTMLElement {
  const list = el("div", "evlist");
  for (const item of items.slice(0, 3)) {
    const ev = el("div", "ev");
    const top = el("div", "evtop");
    const dot = el("span", "evdot");
    dot.style.color = meta(item.source).color;
    top.append(dot, el("span", "evsrc", meta(item.source).label));
    const c = item.confidenceSignals?.confirmationCount;
    ev.append(top, el("div", "evsum", item.summary ?? item.title ?? ""));
    if (typeof c === "number") ev.append(el("div", "evmeta", `${item.source} · ${c} confirmation${c === 1 ? "" : "s"}`));
    list.append(ev);
  }
  return list;
}
function answerCard(data: HelpAnswer): HTMLElement {
  const card = el("div", "card glass lux");
  const chips = el("div", "chiprow");
  chips.append(el("span", "chip status" + (data.status === "ok" ? " ok" : ""), (data.status ?? "ok").replace(/_/g, " ")));
  if (data.intent) chips.append(el("span", "chip", data.intent.replace(/_/g, " ")));
  card.append(chips);
  if (data.answer) card.append(el("div", "answer", data.answer));
  card.append(meterEl(data.confidence ?? 0));
  if (data.sourcesUsed?.length) { card.append(el("div", "section-label", "Who's seeing it")); card.append(pillsEl(data.sourcesUsed)); }
  if (data.evidence?.length) { card.append(el("div", "section-label", "Top evidence")); card.append(evidenceEl(data.evidence)); }
  if (data.followupQuestion) {
    const fu = el("div", "followup");
    fu.append(el("span", "q", "✦"), el("span", undefined, data.followupQuestion));
    card.append(fu);
  }
  if (data.privacyNotice) { const pv = el("div", "privacy"); pv.append(el("span", "dot"), el("span", undefined, data.privacyNotice)); card.append(pv); }
  return card;
}

/* ---------- Ask view: correlation + targeted broadcast ---------- */
function buildAskView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-ask";

  const composer = el("div", "composer glass");
  const ta = el("textarea") as HTMLTextAreaElement;
  ta.placeholder = "Anyone else crashing at the factory boss intro?";
  composer.append(ta);
  composer.append(el("div", "section-label", "Send to"));
  const targets = el("div", "targets");
  const selected = new Set<SourceKind>(connected.map((s) => s.source));
  for (const s of connected) {
    const chip = el("button", "target") as HTMLButtonElement;
    chip.setAttribute("aria-pressed", "true");
    chip.style.setProperty("--tc", meta(s.source).color);
    const led = el("span", "led"); led.style.color = meta(s.source).color;
    chip.append(led, document.createTextNode(meta(s.source).label));
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      if (on) selected.delete(s.source); else selected.add(s.source);
    });
    targets.append(chip);
  }
  composer.append(targets);
  const bbar = el("div", "bbar");
  const checkBtn = el("button", "btn2 go") as HTMLButtonElement;
  checkBtn.textContent = "Check who else ✦";
  const blastBtn = el("button", "btn2") as HTMLButtonElement;
  blastBtn.textContent = "Queue broadcast";
  bbar.append(checkBtn, blastBtn);
  composer.append(bbar);

  const out = el("div", "viewscroll");
  view.append(composer, out);

  const targetList = () => [...selected];

  checkBtn.addEventListener("click", async () => {
    const message = ta.value.trim();
    if (!message) { ta.focus(); return; }
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
      // Fold the user's own "me too" confirmations from the live feed into the read.
      const local = localConfirmations(message);
      if (local.count > 0) {
        const corr = el("div", "corr");
        corr.append(el("span", "spark", "✦"));
        const txt = el("span");
        txt.append(document.createTextNode("You confirmed this "));
        txt.append(el("b", undefined, `${local.count}×`));
        txt.append(document.createTextNode(` from the feed across ${local.sources.map((s) => meta(s).label).join(", ")} — raising prevalence.`));
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
    if (!message) { ta.focus(); return; }
    const sel = targetList();
    if (!sel.length) return;
    out.innerHTML = "";
    const card = el("div", "card glass lux");
    card.append(el("div", "section-label", `Queued ${sel.length} draft${sel.length === 1 ? "" : "s"} — review & approve in the Queue tab`));
    const listEl = el("div", "queued");
    const intent = classifyIntent(message);
    for (const kind of sel) {
      // authentic per-platform poll draft, sent to the real approval queue
      const draft = composeDraft({ kind: "poll", source: kind, topic: message, intent });
      enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body });
      const row = el("div", "qrow");
      const led = el("span", "qled"); led.style.color = meta(kind).color;
      row.append(led, el("span", undefined, `Poll → ${meta(kind).label}`), el("span", "qstate", "Approval"));
      listEl.append(row);
    }
    card.append(listEl);
    const cta = el("button", "btn2 go") as HTMLButtonElement;
    cta.textContent = `Review in Queue (${pendingCount()})`;
    cta.addEventListener("click", () => setActive("queue"));
    card.append(cta);
    out.append(card);
  });

  return view;
}

/* ---------- per-source view: LIVE feed ---------- */
const feedEls: Record<string, HTMLElement> = {};

function renderMsg(m: FeedMsg, kind: string, live = false, showSource = false): HTMLElement {
  const row = el("div", live ? "msg in" : "msg");
  const av = el("div", "av", m.author.charAt(0).toUpperCase());
  av.style.background = meta(kind).color;
  const mb = el("div", "mb");
  const mh = el("div", "mh");
  const sd = el("span", "sdot"); sd.style.background = SENT[m.sentiment];
  mh.append(sd, el("span", "mn", m.author), el("span", "role", m.role));
  if (showSource) { const sb = el("span", "src", meta(kind).label); sb.style.background = meta(kind).color; mh.append(sb); }
  mh.append(el("span", "mt", m.ago));
  mb.append(mh, el("div", "mtext", m.body));
  const react = el("div", "react");
  let up = m.up;
  const upBtn = el("button", "rbtn", `▲ ${up}`) as HTMLButtonElement;
  const meBtn = el("button", "rbtn", "+ me too") as HTMLButtonElement;
  meBtn.addEventListener("click", () => {
    if (meBtn.classList.contains("done")) return;
    up += 1; upBtn.textContent = `▲ ${up}`;
    meBtn.className = "rbtn done"; meBtn.textContent = "✓ me too";
    addSignal(m.body, kind); // real correlation: feeds Ask's prevalence read
  });
  const replyBtn = el("button", "rbtn", "Draft reply") as HTMLButtonElement;
  replyBtn.addEventListener("click", () => {
    if (replyBtn.classList.contains("queued")) return;
    // authentic reply in this platform's voice, folding the message as evidence
    const draft = composeDraft({
      kind: "reply", source: kind as SourceKind, topic: m.body,
      intent: classifyIntent(m.body),
      evidence: [{ id: m.author, source: kind as SourceKind, title: m.author, summary: m.body, matchedTerms: [], confidenceSignals: { semanticMatch: 0.6, exactTermMatch: 0.5, recency: 0.9, sourceTrust: 0.6, confirmationCount: m.up, sameVersionBonus: 0, resolvedBonus: 0, duplicatePenalty: 0, lowQualityPenalty: 0 }, redacted: true }],
    });
    enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body });
    replyBtn.className = "rbtn queued"; replyBtn.textContent = "Queued · approval";
  });
  react.append(upBtn, meBtn, replyBtn);
  mb.append(react);
  row.append(av, mb);
  return row;
}

function buildSourceView(cap: SourceCapabilities): HTMLElement {
  const kind = cap.source;
  const m = meta(kind);
  const view = el("div", "view");
  view.id = `view-${kind}`;

  const head = el("div", "card glass");
  const hr = el("div", "srchead");
  const dot = el("span", "sdot"); dot.style.color = m.color;
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
  const live = el("span", "live"); live.append(el("span", "pulse"), document.createTextNode("Live"));
  fhead.append(el("span", "section-label", `${m.label} community feed`), live);

  const feed = el("div", "feed");
  for (const msg of recentFor(kind)) feed.append(renderMsg(msg, kind));
  feedEls[kind] = feed;

  view.append(head, fhead, feed);
  return view;
}

/* ---------- Pulse: one merged cross-source feed (the home room) ---------- */
let pulseFeed: HTMLElement | null = null;
const pulseRotor: Array<{ kind: string }> = connected.map((s) => ({ kind: s.source }));
let pulseTick = 0;

function buildPulseView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-pulse";

  const head = el("div", "pulsehead");
  const live = el("span", "live"); live.append(el("span", "pulse"), document.createTextNode("Live"));
  head.append(el("span", "section-label", "Pulse · every connected source, interleaved"), live);

  // seed: the freshest message from each source, newest first
  const feed = el("div", "feed");
  const seed = connected.map((s) => ({ kind: s.source, msg: recentFor(s.source)[0] }));
  for (const s of seed) feed.append(renderMsg(s.msg, s.kind, false, true));
  pulseFeed = feed;

  view.append(head, feed);
  return view;
}

/* ---------- Queue: review & approve drafts (closes the loop) ---------- */
const ACTION_LABEL: Record<string, string> = { reply: "Reply", poll: "Poll", known_issue: "Known Issue", faq: "FAQ", announcement: "Announcement" };
let queueBody: HTMLElement | null = null;

function renderQueue(container: HTMLElement) {
  container.innerHTML = "";
  const items = queueList();
  if (items.length === 0) {
    const empty = el("div", "queue-empty");
    empty.append(el("span", "big", "✎"), document.createTextNode("No drafts yet. Use “Draft reply” on a feed message, or “Queue broadcast” in Ask — they land here for your approval."));
    container.append(empty);
    return;
  }
  for (const item of items) renderDraftCard(container, item);
}

function renderDraftCard(container: HTMLElement, item: QueueItem) {
  const card = el("div", "draft card glass lux");
  const dh = el("div", "dh");
  const kind = el("span", "dkind", ACTION_LABEL[item.actionType] ?? item.actionType);
  kind.style.background = meta(item.source).color;
  const src = el("span", "dsrc");
  const led = el("span", "led"); led.style.color = meta(item.source).color;
  src.append(led, document.createTextNode(meta(item.source).label));
  const state = el("span", `dstate ${item.status}`, item.status);
  dh.append(kind, src, state);
  card.append(dh);

  if (item.title) card.append(el("div", "dtitle", item.title));

  const body = el("textarea", "dbody") as HTMLTextAreaElement;
  body.value = item.body;
  body.disabled = item.status !== "queued";
  body.addEventListener("input", () => updateBody(item.id, body.value));
  card.append(body);

  if (item.status === "queued") {
    const actions = el("div", "dactions");
    const approve = el("button", "dbtn approve", "✓ Approve") as HTMLButtonElement;
    approve.addEventListener("click", () => setStatus(item.id, "approved"));
    const reject = el("button", "dbtn reject", "Reject") as HTMLButtonElement;
    reject.addEventListener("click", () => setStatus(item.id, "rejected"));
    const copy = el("button", "dbtn copy", "Copy") as HTMLButtonElement;
    copy.addEventListener("click", async () => { await navigator.clipboard?.writeText(body.value).catch(() => {}); copy.textContent = "Copied ✓"; window.setTimeout(() => (copy.textContent = "Copy"), 1500); });
    actions.append(approve, reject, copy);
    card.append(actions);
  } else if (item.status === "approved") {
    const pv = el("div", "privacy");
    pv.append(el("span", "dot"), el("span", undefined, "Approved — paste into the client to post. Help Me never posts on its own."));
    card.append(pv);
  }
  container.append(card);
}

function buildQueueView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-queue";
  view.append(el("div", "section-label", "Approval queue · nothing posts until you approve"));
  const body = el("div", "result");
  queueBody = body;
  renderQueue(body);
  view.append(body);
  return view;
}

/* ---------- nav (Ask + Pulse + connected sources + Queue) ---------- */
const nav = document.getElementById("nav") as HTMLElement;
const indicator = document.getElementById("ind") as HTMLElement;
const views = document.getElementById("views") as HTMLElement;

type NavItem = { id: string; label: string; accent: string };
const navItems: NavItem[] = [
  { id: "ask", label: "Ask", accent: "#4cc2ff" },
  { id: "pulse", label: "Pulse", accent: "#2ee06a" },
  ...connected.map((s) => ({ id: s.source, label: meta(s.source).label, accent: meta(s.source).color })),
  { id: "queue", label: "Queue", accent: "#e0964a" },
];

views.append(buildAskView(), buildPulseView(), ...connected.map((s) => buildSourceView(s)), buildQueueView());

const navButtons: HTMLButtonElement[] = navItems.map((item) => {
  const b = el("button", "tab") as HTMLButtonElement;
  b.dataset.tab = item.id;
  b.dataset.accent = item.accent;
  b.style.setProperty("--a", item.accent);
  b.append(el("span", "led"), document.createTextNode(item.label));
  b.addEventListener("click", () => setActive(item.id));
  nav.append(b);
  return b;
});

// pending-draft badge on the Queue tab; live-updates as drafts come/go
const queueBtn = navButtons.find((b) => b.dataset.tab === "queue");
function refreshQueueBadge() {
  if (!queueBtn) return;
  queueBtn.querySelector(".badge")?.remove();
  const n = pendingCount();
  if (n > 0) queueBtn.append(el("span", "badge", String(n)));
}
onQueueChange(() => {
  refreshQueueBadge();
  if (activeView === "queue" && queueBody) renderQueue(queueBody);
});

let activeView: string = "ask";
function setActive(id: string) {
  const btn = navButtons.find((b) => b.dataset.tab === id);
  if (!btn) return;
  navButtons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
  nav.style.setProperty("--tab-accent", btn.dataset.accent ?? "#4cc2ff");
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  indicator.style.width = `${btn.offsetWidth}px`;
  btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  views.querySelectorAll<HTMLElement>(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id}`));
  activeView = id;
  if (id === "queue" && queueBody) renderQueue(queueBody); // refresh on open
}

// live trickle — only the visible feed grows (a source feed, or Pulse merged)
window.setInterval(() => {
  if (activeView === "pulse" && pulseFeed) {
    const kind = pulseRotor[pulseTick++ % pulseRotor.length].kind; // round-robin sources
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
  if (cur) { indicator.style.transform = `translateX(${cur.offsetLeft}px)`; indicator.style.width = `${cur.offsetWidth}px`; }
});
