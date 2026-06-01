import {
  aggregateConfidence,
  classifyIntent,
  communityHelp,
  composeDraft,
  mockWorkspaceContext,
  rankEvidence,
  type DraftKind,
  type DraftTone,
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
import { applyEdit, clearResolved, enqueue, hydrate as hydrateQueue, list as queueList, onChange as onQueueChange, pendingCount, remove as removeQueued, setStatus, updateBody, type QueueItem } from "./queue";
import { getLastTab, getTargets, hydratePrefs, setLastTab, setTargets } from "./prefs";
import { getSettings, hydrateSettings, onSettingsChange, setSettings } from "./settings";
import { SITE_INFO } from "./pageReaders";
import { connect, hydrateConnections, isConnected } from "./connections";
import { readActiveTab } from "./liveReader";
import { correlate, type WrenchFinding, type WrenchId } from "@help-me-comms/core";
import { createMockWrenchBridges, FOTW_STATION, MOD_STATION, DEF_STATION, MYNE_STATION } from "@help-me-comms/adapters";
import { hydrateRack, isPaired, listPaired, togglePair } from "./rack";
import { addCustom, hydrateCustom, listCustom, onCustomChange, removeCustom, type CustomKind, type CustomSource } from "./customSources";
import { CustomSourceAdapter } from "@help-me-comms/adapters";

// module-level UI state, declared before any function that uses it
let queueBody: HTMLElement | null = null;
let activeView = "ask";

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
  // restore saved target selection (falls back to all connected)
  const savedTargets = getTargets(connected.map((s) => s.source));
  const selected = new Set<SourceKind>(savedTargets.filter((t) => connected.some((s) => s.source === t)) as SourceKind[]);
  for (const s of connected) {
    const chip = el("button", "target") as HTMLButtonElement;
    chip.setAttribute("aria-pressed", String(selected.has(s.source)));
    chip.style.setProperty("--tc", meta(s.source).color);
    const led = el("span", "led"); led.style.color = meta(s.source).color;
    chip.append(led, document.createTextNode(meta(s.source).label));
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      if (on) selected.delete(s.source); else selected.add(s.source);
      setTargets([...selected]); // persist
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
      enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body, tone: "auto", recompose: { kind: "poll", topic: message, intent } });
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
    enqueue({ actionType: draft.actionType, source: kind, title: draft.title, body: draft.body, tone: "auto", recompose: { kind: "reply", topic: m.body, intent: classifyIntent(m.body) } });
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
  const live = el("span", "live"); live.append(el("span", "pulse"), document.createTextNode("Demo"));
  fhead.append(el("span", "section-label", `${m.label} community feed`), live);

  const feed = el("div", "feed");
  for (const msg of recentFor(kind)) feed.append(renderMsg(msg, kind));
  feedEls[kind] = feed;

  // Live "read this page" control — only for sites FOTW² can scrape (Discord/Reddit/Steam/GitHub)
  if (kind in SITE_INFO) {
    const bar = el("div", "livebar");
    const status = el("span", "livestatus", "");
    const btn = el("button", "btn2 go", "Read this page ✦") as HTMLButtonElement;
    btn.addEventListener("click", async () => {
      btn.disabled = true; status.textContent = "Reading…";
      if (!isConnected(kind)) {
        const ok = await connect(kind);
        if (!ok) { status.textContent = "Connect declined"; btn.disabled = false; return; }
      }
      const res = await readActiveTab();
      btn.disabled = false;
      if (!res.ok) {
        status.textContent =
          res.reason === "not_on_site" ? `Open a ${m.label} tab, then read` :
          res.reason === "no_permission" ? "Not connected yet" :
          res.reason === "blocked" ? "Page blocked the read" : "No active tab";
        return;
      }
      if (res.site !== kind) { status.textContent = `That tab is ${SITE_INFO[res.site]?.label ?? res.site}, not ${m.label}`; return; }
      feed.innerHTML = "";
      if (!res.messages.length) { status.textContent = "No messages found on this page"; return; }
      for (const sm of res.messages) feed.append(renderMsg({ author: sm.author, role: "player", body: sm.body, ago: sm.ago || "now", sentiment: "neu", up: 0 }, kind, false));
      live.innerHTML = ""; live.append(el("span", "pulse"), document.createTextNode("Live"));
      status.textContent = `${res.messages.length} live messages from your ${m.label} session`;
    });
    bar.append(btn, status);
    view.append(head, bar, fhead, feed);
  } else {
    view.append(head, fhead, feed);
  }
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

function renderQueue(container: HTMLElement) {
  container.innerHTML = "";
  const items = queueList();
  if (items.length === 0) {
    const empty = el("div", "queue-empty");
    empty.append(el("span", "big", "✎"), document.createTextNode("No drafts yet. Use “Draft reply” on a feed message, or “Queue broadcast” in Ask — they land here for your approval."));
    container.append(empty);
    return;
  }
  const resolved = items.filter((i) => i.status !== "queued").length;
  if (resolved > 0) {
    const bar = el("div", "qclearbar");
    const clear = el("button", "dbtn", `Clear ${resolved} resolved`) as HTMLButtonElement;
    clear.addEventListener("click", () => clearResolved());
    bar.append(clear);
    container.append(bar);
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

  // tone picker — recomposes the draft body in a different voice
  if (item.status === "queued" && item.recompose) {
    const tr = el("div", "tonerow");
    tr.append(el("span", "tonelabel", "Tone"));
    const sel = el("select", "toneselect") as HTMLSelectElement;
    for (const [v, label] of [["auto", "Native voice"], ["friendly", "Friendly"], ["official", "Official"], ["technical", "Technical"], ["casual", "Casual"]]) {
      const o = el("option") as HTMLOptionElement; o.value = v; o.textContent = label;
      if ((item.tone ?? "auto") === v) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", () => {
      const rc = item.recompose!;
      const d = composeDraft({ kind: rc.kind as DraftKind, source: item.source as SourceKind, topic: rc.topic, intent: rc.intent as ReturnType<typeof classifyIntent>, tone: sel.value as DraftTone });
      applyEdit(item.id, { body: d.body, tone: sel.value });
    });
    tr.append(sel);
    card.append(tr);
  }

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
  } else {
    const row = el("div", "dactions");
    if (item.status === "approved") {
      const pv = el("div", "privacy");
      pv.append(el("span", "dot"), el("span", undefined, "Approved — paste into the client to post. Help Me never posts on its own."));
      card.append(pv);
    }
    const del = el("button", "dbtn", "Remove") as HTMLButtonElement;
    del.addEventListener("click", () => removeQueued(item.id));
    row.append(del);
    card.append(row);
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
const CUSTOM_COLORS = ["#4cc2ff", "#7d88c8", "#e0964a", "#2ee06a", "#66c0f4", "#c9d1d9"];

// Real feed view for a user-added Discourse/RSS source (fetched live, no mock).
function buildCustomFeedView(cs: CustomSource): HTMLElement {
  const view = el("div", "view");
  view.id = `view-${cs.id}`;
  const head = el("div", "card glass");
  const hr = el("div", "srchead");
  const dot = el("span", "sdot"); dot.style.color = cs.color;
  hr.append(dot, el("span", "sname", cs.label), el("span", "sreach", cs.type));
  head.append(hr, el("div", "addhint", cs.url));
  const feed = el("div", "feed");
  feed.append(el("div", "addhint", "Loading…"));
  view.append(head, feed);

  const adapter = new CustomSourceAdapter({ id: cs.id, label: cs.label, type: cs.type as CustomKind, url: cs.url });
  adapter.getThread({ source: "forum", externalId: cs.id }, workspace).then((thread) => {
    feed.innerHTML = "";
    if (!thread.items.length) { feed.append(el("div", "addhint", "No items yet (or the source blocked the request from the browser).")); return; }
    for (const it of thread.items.slice(0, 12)) {
      feed.append(renderMsg({ author: cs.label, role: "player", body: it.body, ago: "", sentiment: "neu", up: 0 }, "forum", false));
    }
  }).catch(() => { feed.innerHTML = ""; feed.append(el("div", "addhint", "Couldn't reach that source from the browser.")); });

  return view;
}

// The "Add" tab — wire up any Discourse forum or RSS/Atom feed, no code.
function buildAddView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-add";
  const form = el("div", "addform card glass");
  form.append(el("div", "section-label", "Add a custom source"));

  const nameWrap = el("div");
  nameWrap.append(el("label", undefined, "Name"));
  const name = el("input") as HTMLInputElement; name.placeholder = "My Game Forum";
  nameWrap.append(name);

  const row = el("div", "row2");
  const typeWrap = el("div");
  typeWrap.append(el("label", undefined, "Type"));
  const type = el("select") as HTMLSelectElement;
  for (const [v, t] of [["discourse", "Discourse forum"], ["rss", "RSS / Atom feed"]]) {
    const o = el("option") as HTMLOptionElement; o.value = v; o.textContent = t; type.append(o);
  }
  typeWrap.append(type);
  const colorWrap = el("div");
  colorWrap.append(el("label", undefined, "Accent"));
  const color = el("select") as HTMLSelectElement;
  for (const c of CUSTOM_COLORS) { const o = el("option") as HTMLOptionElement; o.value = c; o.textContent = c; color.append(o); }
  colorWrap.append(color);
  row.append(typeWrap, colorWrap);

  const urlWrap = el("div");
  urlWrap.append(el("label", undefined, "URL"));
  const url = el("input") as HTMLInputElement; url.placeholder = "https://forum.mygame.com  or  https://site.com/feed.xml";
  urlWrap.append(url);

  const add = el("button", "primary") as HTMLButtonElement;
  add.textContent = "Add source ✦";
  add.addEventListener("click", () => {
    const label = name.value.trim(); const u = url.value.trim();
    if (!label || !u) { (label ? url : name).focus(); return; }
    addCustom({ label, type: type.value as CustomKind, url: u, color: color.value });
    name.value = ""; url.value = "";
  });

  form.append(nameWrap, row, urlWrap, add);
  form.append(el("div", "addhint", "Discourse forums expose a public JSON API. RSS/Atom works for devlogs, patch-note feeds, and many forums. Read-only — nothing is ever posted. Some sites may block browser requests (CORS); those still work via the team app / MCP."));
  view.append(form);

  // existing custom sources
  const mine = el("div", "result");
  const renderMine = () => {
    mine.innerHTML = "";
    const all = listCustom();
    if (!all.length) return;
    mine.append(el("div", "section-label", "Your sources"));
    for (const cs of all) {
      const r = el("div", "mysrc");
      const led = el("span", "led"); led.style.color = cs.color;
      const meta2 = el("div");
      meta2.append(el("div", "mn", cs.label), el("div", "mu", `${cs.type} · ${cs.url}`));
      const rm = el("button", "dbtn rm", "Remove") as HTMLButtonElement;
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

let navItems: NavItem[] = [];
let navButtons: HTMLButtonElement[] = [];

// ---------- The Rack: the wrench cockpit + cross-wrench spine ----------
const WRENCH_STATIONS = [FOTW_STATION, MOD_STATION, DEF_STATION, MYNE_STATION];
const wrenchBridges = createMockWrenchBridges();
let rackThreadHost: HTMLElement | null = null;

function buildRackView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-rack";
  const rack = el("div", "rack");

  rack.append(el("div", "section-label", "Your wrenches · pair the ones you run"));
  const pegboard = el("div", "pegboard");
  for (const st of WRENCH_STATIONS) {
    const card = el("button", "wrenchcard") as HTMLButtonElement;
    card.style.setProperty("--wc", st.color);
    card.setAttribute("aria-pressed", String(isPaired(st.id)));
    card.setAttribute("data-available", String(st.available));
    const name = el("div", "wname");
    const ico = el("div", "wico", st.label.charAt(0)); ico.style.background = st.color;
    name.append(ico, document.createTextNode(st.label));
    card.append(name, el("div", "wtag", st.tagline));
    const state = el("div", `wstate ${isPaired(st.id) ? "on" : "off"}`, st.id === "fotw" ? "cockpit" : (isPaired(st.id) ? "paired" : "tap to pair"));
    card.append(state);
    card.addEventListener("click", () => {
      togglePair(st.id);
      card.setAttribute("aria-pressed", String(isPaired(st.id)));
      state.className = `wstate ${isPaired(st.id) ? "on" : "off"}`;
      state.textContent = st.id === "fotw" ? "cockpit" : (isPaired(st.id) ? "paired" : "tap to pair");
    });
    pegboard.append(card);
  }
  rack.append(pegboard);

  // the threaded story
  rack.append(el("div", "section-label", "Cross-wrench thread"));
  const composer = el("div", "composer glass");
  const ta = el("textarea") as HTMLTextAreaElement;
  ta.placeholder = "What are you chasing? e.g. 'crashing at the factory boss'";
  const bar = el("div", "composer-bar");
  bar.append(el("span", "hint", "Threads one story across your paired wrenches"));
  const btn = el("button", "primary", "Thread it ✦") as HTMLButtonElement;
  bar.append(btn);
  composer.append(ta, bar);

  const threadHost = el("div", "result");
  rackThreadHost = threadHost;
  threadHost.append(emptyThread());

  btn.addEventListener("click", async () => {
    const topic = ta.value.trim();
    if (!topic) { ta.focus(); return; }
    btn.disabled = true;
    threadHost.innerHTML = "";
    const loading = el("div", "card glass lux");
    loading.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
    threadHost.append(loading);
    try {
      // FOTW² (the cockpit) contributes the community signal as the lead;
      // the paired wrenches add cause/fix/economy.
      const paired = new Set(listPaired());
      const help = await communityHelp({ userMessage: topic, sourcePolicy: "auto_scope_connected_sources" }, workspace, allAdapters);
      const fotwBridge = {
        id: "fotw" as WrenchId,
        station: FOTW_STATION,
        findings: async (): Promise<WrenchFinding[]> => help.evidence?.length
          ? [{ wrench: "fotw" as WrenchId, kind: "community_signal", title: "Community signal", detail: `${help.answer.split("\n")[0]} (${Math.round((help.confidence ?? 0) * 100)}% across ${help.sourcesUsed.join(", ")})`, weight: help.confidence ?? 0.5 }]
          : [],
      };
      const active = [fotwBridge, ...wrenchBridges.filter((b) => paired.has(b.id))];
      const thread = await correlate(topic, active);
      threadHost.innerHTML = "";
      threadHost.append(renderThread(thread));
    } finally {
      btn.disabled = false;
    }
  });

  rack.append(composer, threadHost);
  view.append(rack);
  return view;
}

function emptyThread(): HTMLElement {
  const e = el("div", "emptythread");
  e.append(document.createTextNode("Pair your wrenches above, then thread a topic. FOTW² brings the community signal; ModWrench the likely cause; DefWrench the fix; MyneWrench the impact — one story, not six screens."));
  return e;
}

const WSTATION: Record<string, { label: string; color: string }> = {
  fotw: { label: "FOTW²", color: "#7d88c8" },
  mod: { label: "ModWrench", color: "#4cc2ff" },
  def: { label: "DefWrench", color: "#e0964a" },
  myne: { label: "MyneWrench", color: "#2ee06a" },
};

function renderThread(thread: { topic: string; findings: WrenchFinding[]; story: string; contributors: string[]; confidence: number }): HTMLElement {
  const card = el("div", "thread card glass lux");
  if (!thread.findings.length) { card.append(emptyThread()); return card; }
  card.append(el("div", "tlead", `“${thread.topic}” — threaded across ${thread.contributors.length} wrench${thread.contributors.length === 1 ? "" : "es"}`));
  card.append(meterEl(thread.confidence));
  const chain = el("div", "chain");
  for (const f of thread.findings) {
    const ws = WSTATION[f.wrench] ?? { label: f.wrench, color: "#9aa6c4" };
    const link = el("div", "link");
    link.style.setProperty("--lc", ws.color);
    const node = el("div", "lnode", ws.label.charAt(0)); node.style.background = ws.color;
    const body = el("div", "lbody");
    body.append(el("div", "lwrench", ws.label), el("div", "ltitle", f.title), el("div", "ldetail", f.detail));
    if (f.ref) body.append(el("span", "lref", f.ref));
    link.append(node, body);
    chain.append(link);
  }
  card.append(chain);
  return card;
}

// ---------- Settings tab ----------
function buildSettingsView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-settings";
  const card = el("div", "addform card glass");
  card.append(el("div", "section-label", "Settings"));

  const s = getSettings();

  // live trickle toggle
  const trickWrap = el("div", "setrow");
  const trickLabel = el("label", undefined, "Live feed trickle");
  const trick = el("select", "toneselect") as HTMLSelectElement;
  for (const [v, label] of [["on", "On"], ["off", "Off"]]) {
    const o = el("option") as HTMLOptionElement; o.value = v; o.textContent = label;
    if ((s.trickle ? "on" : "off") === v) o.selected = true;
    trick.append(o);
  }
  trick.addEventListener("change", () => setSettings({ trickle: trick.value === "on" }));
  trickWrap.append(trickLabel, trick);

  // trickle speed
  const speedWrap = el("div", "setrow");
  const speedLabel = el("label", undefined, "Feed speed");
  const speed = el("select", "toneselect") as HTMLSelectElement;
  for (const [v, label] of [["2500", "Fast"], ["4500", "Normal"], ["8000", "Slow"]]) {
    const o = el("option") as HTMLOptionElement; o.value = v; o.textContent = label;
    if (String(s.trickleMs) === v) o.selected = true;
    speed.append(o);
  }
  speed.addEventListener("change", () => setSettings({ trickleMs: Number(speed.value) }));
  speedWrap.append(speedLabel, speed);

  card.append(trickWrap, speedWrap);

  // data controls
  const danger = el("div", "addform");
  danger.append(el("div", "section-label", "Data"));
  const clearQ = el("button", "dbtn", "Clear all drafts") as HTMLButtonElement;
  clearQ.addEventListener("click", () => { queueList().slice().forEach((q) => removeQueued(q.id)); });
  const clearAll = el("button", "dbtn reject", "Reset everything (drafts, sources, prefs)") as HTMLButtonElement;
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
    ...connected.map((s) => ({ id: s.source, label: meta(s.source).label, accent: meta(s.source).color })),
    ...custom.map((c) => ({ id: c.id, label: c.label, accent: c.color })),
    { id: "queue", label: "Queue", accent: "#e0964a" },
    { id: "add", label: "+ Add", accent: "#7d88c8" },
    { id: "settings", label: "⚙", accent: "#9aa6c4" },
  ];

  views.innerHTML = "";
  views.append(
    buildAskView(),
    buildRackView(),
    buildPulseView(),
    ...connected.map((s) => buildSourceView(s)),
    ...custom.map((c) => buildCustomFeedView(c)),
    buildQueueView(),
    buildAddView(),
    buildSettingsView(),
  );

  nav.querySelectorAll(".tab").forEach((b) => b.remove());
  navButtons = navItems.map((item) => {
    const b = el("button", "tab") as HTMLButtonElement;
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

// pending-draft badge on the Queue tab; live-updates as drafts come/go
function refreshQueueBadge() {
  const queueBtn = navButtons.find((b) => b.dataset.tab === "queue");
  if (!queueBtn) return;
  queueBtn.querySelector(".badge")?.remove();
  const n = pendingCount();
  if (n > 0) queueBtn.append(el("span", "badge", String(n)));
}
onQueueChange(() => {
  refreshQueueBadge();
  if (activeView === "queue" && queueBody) renderQueue(queueBody);
});

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
  setLastTab(id); // persist
  if (id === "queue" && queueBody) renderQueue(queueBody); // refresh on open
}

// live trickle — only the visible feed grows (a source feed, or Pulse merged).
// Interval is rescheduled when the Settings speed/toggle changes.
let trickleTimer: number | undefined;
function trickleTick() {
  if (!getSettings().trickle) return;
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
}
function scheduleTrickle() {
  if (trickleTimer !== undefined) window.clearInterval(trickleTimer);
  trickleTimer = window.setInterval(trickleTick, getSettings().trickleMs);
}
onSettingsChange(scheduleTrickle);

// Hydrate persisted state, then build nav and restore the last tab + queue.
Promise.all([hydrateQueue(), hydratePrefs(), hydrateCustom(), hydrateSettings(), hydrateConnections(), hydrateRack()]).then(() => {
  scheduleTrickle();
  rebuildNav();
  if (queueBody) renderQueue(queueBody);
  const last = getLastTab();
  const validTabs = new Set(navItems.map((n) => n.id));
  requestAnimationFrame(() => setActive(last && validTabs.has(last) ? last : "ask"));
});

// adding/removing a custom source rebuilds the nav, keeping the current tab if it still exists
onCustomChange(() => {
  const current = activeView;
  rebuildNav();
  const validTabs = new Set(navItems.map((n) => n.id));
  setActive(validTabs.has(current) ? current : "add");
});

window.addEventListener("resize", () => {
  const cur = navButtons.find((b) => b.getAttribute("aria-selected") === "true");
  if (cur) { indicator.style.transform = `translateX(${cur.offsetLeft}px)`; indicator.style.width = `${cur.offsetWidth}px`; }
});
