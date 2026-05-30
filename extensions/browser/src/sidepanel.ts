import {
  aggregateConfidence,
  classifyIntent,
  communityHelp,
  mockWorkspaceContext,
  rankEvidence,
  type EvidenceItem,
  type HelpAnswer,
  type SourceCapabilities,
  type SourceKind,
} from "@help-me-comms/core";
import { BaseMockAdapter, createDefaultMockAdapters } from "@help-me-comms/adapters";
import { initShaderBackground } from "./shaderBg";
import { initParallax } from "./spatial";

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

// The brain runs in-extension — no server. Workspace + adapters are local.
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

/* ---------------- reusable result pieces ---------------- */
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

/* ---------------- Ask view (auto-scoped across all sources) ---------------- */
function buildAskView(): HTMLElement {
  const view = el("div", "view");
  view.id = "view-ask";

  const composer = el("div", "composer glass");
  const ta = el("textarea") as HTMLTextAreaElement;
  ta.placeholder = "I'm crashing at the factory boss intro. What do I do?";
  const bar = el("div", "composer-bar");
  bar.append(el("span", "hint", "Auto-scopes your connected sources"));
  const btn = el("button", "primary") as HTMLButtonElement;
  btn.textContent = "Ask Help Me ✦";
  bar.append(btn);
  composer.append(ta, bar);

  const out = el("div", "viewscroll");
  view.append(composer, out);

  btn.addEventListener("click", async () => {
    const message = ta.value.trim();
    if (!message) { ta.focus(); return; }
    btn.disabled = true;
    out.innerHTML = "";
    const loading = el("div", "card glass lux");
    loading.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
    out.append(loading);
    try {
      const data: HelpAnswer = await communityHelp(
        { userMessage: message, sourcePolicy: "auto_scope_connected_sources" },
        workspace,
        allAdapters,
      );
      out.innerHTML = "";
      const card = el("div", "card glass lux");
      const chips = el("div", "chiprow");
      chips.append(el("span", "chip status" + (data.status === "ok" ? " ok" : ""), (data.status ?? "ok").replace(/_/g, " ")));
      if (data.intent) chips.append(el("span", "chip", data.intent.replace(/_/g, " ")));
      card.append(chips);
      if (data.answer) card.append(el("div", "answer", data.answer));
      card.append(meterEl(data.confidence ?? 0));
      if (data.sourcesUsed?.length) { card.append(el("div", "section-label", "Sources scoped")); card.append(pillsEl(data.sourcesUsed)); }
      if (data.evidence?.length) { card.append(el("div", "section-label", "Top evidence")); card.append(evidenceEl(data.evidence)); }
      if (data.followupQuestion) {
        const fu = el("div", "followup");
        fu.append(el("span", "q", "✦"), el("span", undefined, data.followupQuestion));
        card.append(fu);
      }
      if (data.suggestedActions?.length) {
        card.append(el("div", "section-label", "Suggested next actions"));
        const acts = el("div", "acts");
        for (const a of data.suggestedActions) {
          const b = el("button", "act");
          b.append(el("span", "glyph", "✎"), el("span", undefined, a.label));
          if (a.requiresApproval) b.append(el("span", "gate", "Approval"));
          acts.append(b);
        }
        card.append(acts);
      }
      if (data.privacyNotice) { const pv = el("div", "privacy"); pv.append(el("span", "dot"), el("span", undefined, data.privacyNotice)); card.append(pv); }
      out.append(card);
    } finally {
      btn.disabled = false;
    }
  });

  return view;
}

/* ---------------- per-source view (focused on one source) ---------------- */
function capChips(cap: SourceCapabilities): HTMLElement {
  const caps = el("div", "caps");
  caps.append(el("span", "cap on", "read"));
  const writeCls = cap.write === "disabled" ? "cap off" : cap.write === "enabled" ? "cap on" : "cap warn";
  caps.append(el("span", writeCls, `write: ${cap.write.replace(/_/g, " ")}`));
  if (cap.supportsThreads) caps.append(el("span", "cap", "threads"));
  if (cap.supportsSearch) caps.append(el("span", "cap", "search"));
  if (cap.supportsRealtime) caps.append(el("span", "cap", "realtime"));
  if (cap.supportsPrivateSpaces) caps.append(el("span", "cap", "private spaces"));
  return caps;
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
  head.append(hr, capChips(cap));
  if (cap.approvedSpaces?.length) {
    head.append(el("div", "section-label", "Approved spaces"));
    head.append(pillsEl([])); // placeholder removed below
    head.lastChild?.remove();
    const spaces = el("div", "pills");
    for (const s of cap.approvedSpaces) spaces.append(el("span", "pill", "#" + s));
    head.append(spaces);
  }

  const composer = el("div", "composer glass");
  const ta = el("textarea") as HTMLTextAreaElement;
  ta.placeholder = `Search ${m.label} for a crash, bottleneck, or topic…`;
  const bar = el("div", "composer-bar");
  bar.append(el("span", "hint", `Scoped to ${m.label} only`));
  const btn = el("button", "primary") as HTMLButtonElement;
  btn.textContent = `Search ${m.label} ✦`;
  bar.append(btn);
  composer.append(ta, bar);

  const out = el("div", "viewscroll");
  view.append(head, composer, out);

  btn.addEventListener("click", async () => {
    const message = ta.value.trim();
    if (!message) { ta.focus(); return; }
    btn.disabled = true;
    out.innerHTML = "";
    try {
      const intent = classifyIntent(message);
      const evidence = rankEvidence(await adapterFor(kind).search({ query: message, intent, timeWindow: "14d", maxEvidence: 10 }, workspace));
      const confidence = aggregateConfidence(evidence);
      const card = el("div", "card glass lux");
      const chips = el("div", "chiprow");
      chips.append(el("span", "chip", intent.replace(/_/g, " ")));
      card.append(chips);
      card.append(el("div", "answer", evidence.length
        ? `Top ${m.label} signal: ${evidence[0].summary}`
        : `No recent ${m.label} signal for that yet — try broader wording.`));
      card.append(meterEl(confidence));
      if (evidence.length) { card.append(el("div", "section-label", `${m.label} evidence`)); card.append(evidenceEl(evidence)); }
      const pv = el("div", "privacy"); pv.append(el("span", "dot"), el("span", undefined, "Evidence is scoped and discarded after the task.")); card.append(pv);
      out.append(card);
    } finally {
      btn.disabled = false;
    }
  });

  return view;
}

/* ---------------- nav (sections = Ask + your connected sources) ---------------- */
const nav = document.getElementById("nav") as HTMLElement;
const indicator = document.getElementById("ind") as HTMLElement;
const views = document.getElementById("views") as HTMLElement;

type NavItem = { id: string; label: string; accent: string };
const navItems: NavItem[] = [
  { id: "ask", label: "Ask", accent: "#4cc2ff" },
  ...connected.map((s) => ({ id: s.source, label: meta(s.source).label, accent: meta(s.source).color })),
];

views.append(buildAskView(), ...connected.map((s) => buildSourceView(s)));

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

function setActive(id: string) {
  const btn = navButtons.find((b) => b.dataset.tab === id);
  if (!btn) return;
  navButtons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
  nav.style.setProperty("--tab-accent", btn.dataset.accent ?? "#4cc2ff");
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  indicator.style.width = `${btn.offsetWidth}px`;
  btn.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  views.querySelectorAll<HTMLElement>(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${id}`));
}

requestAnimationFrame(() => setActive("ask"));
window.addEventListener("resize", () => {
  const cur = navButtons.find((b) => b.getAttribute("aria-selected") === "true");
  if (cur) { indicator.style.transform = `translateX(${cur.offsetLeft}px)`; indicator.style.width = `${cur.offsetWidth}px`; }
});
