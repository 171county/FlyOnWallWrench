import { initShaderBackground } from "./shaderBg.js";
import { initParallax } from "./spatial.js";

initShaderBackground("bg");
initParallax();

const LOCAL_APP = "http://localhost:3000";

type SuggestedAction = { type: string; label: string; requiresApproval?: boolean };
type HelpAnswer = {
  status?: string;
  intent?: string;
  confidence?: number;
  answer?: string;
  followupQuestion?: string;
  sourcesUsed?: string[];
  evidence?: EvidenceItem[];
  suggestedActions?: SuggestedAction[];
  privacyNotice?: string;
};

type EvidenceItem = {
  source: string;
  title?: string;
  summary?: string;
  confidenceSignals?: { confirmationCount?: number };
};

const SOURCE_META: Record<string, { label: string; color: string }> = {
  discord: { label: "Discord", color: "#5865f2" },
  reddit: { label: "Reddit", color: "#ff4500" },
  steam_reviews: { label: "Steam", color: "#66c0f4" },
  steam_news: { label: "Steam News", color: "#66c0f4" },
  forum: { label: "Forum", color: "#b6ff5a" },
  github_discussions: { label: "GitHub", color: "#c9d1d9" },
  github_issues: { label: "GitHub Issues", color: "#c9d1d9" },
  youtube: { label: "YouTube", color: "#ff4d9d" },
  twitch: { label: "Twitch", color: "#8b5cff" },
  slack: { label: "Slack", color: "#36c5f0" },
  matrix: { label: "Matrix", color: "#0dbd8b" },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------------- tab bar ---------------- */
const tabs = document.getElementById("tabs") as HTMLElement;
const indicator = document.getElementById("tab-ind") as HTMLElement;
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab"));

function moveIndicator(btn: HTMLButtonElement) {
  indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
  indicator.style.width = `${btn.offsetWidth}px`;
}

function setTab(name: string) {
  const btn = tabButtons.find((b) => b.dataset.tab === name);
  if (!btn) return;
  tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
  tabs.style.setProperty("--tab-accent", btn.dataset.accent ?? "#38e8ff");
  moveIndicator(btn);
  document.querySelectorAll<HTMLElement>(".view").forEach((v) => {
    v.classList.toggle("active", v.id === `view-${name}`);
  });
}

tabButtons.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab as string)));
requestAnimationFrame(() => setTab("ask"));
window.addEventListener("resize", () => {
  const cur = tabButtons.find((b) => b.getAttribute("aria-selected") === "true");
  if (cur) moveIndicator(cur);
});

/* ---------------- rendering ---------------- */
function chipRow(data: HelpAnswer) {
  const chips = el("div", "chiprow");
  const status = (data.status ?? "ok").replace(/_/g, " ");
  chips.append(el("span", "chip status" + (data.status === "ok" ? " ok" : ""), status));
  if (data.intent) chips.append(el("span", "chip", data.intent.replace(/_/g, " ")));
  return chips;
}

function confidenceMeter(value: number) {
  const pct = Math.round(value * 100);
  const wrap = el("div");
  wrap.append(el("div", "meter-label", "Confidence"));
  const row = el("div", "meter-wrap");
  const meter = el("div", "meter");
  const fill = el("i");
  fill.style.width = pct + "%";
  meter.append(fill);
  row.append(meter, el("span", "meter-val", pct + "%"));
  wrap.append(row);
  return wrap;
}

function fill(viewId: string, build: (card: HTMLElement) => void) {
  const view = document.getElementById(viewId) as HTMLElement;
  view.innerHTML = "";
  const card = el("div", "card glass");
  build(card);
  view.append(card);
}

function render(data: HelpAnswer) {
  // Answer tab
  fill("view-answer", (card) => {
    card.append(chipRow(data));
    if (data.answer) card.append(el("div", "answer", data.answer));
    if (data.followupQuestion) {
      const fu = el("div", "followup");
      fu.append(el("span", "q", "✦"), el("span", undefined, data.followupQuestion));
      card.append(fu);
    }
  });

  // Evidence tab
  fill("view-sources", (card) => {
    if (typeof data.confidence === "number") card.append(confidenceMeter(data.confidence));
    if (data.sourcesUsed?.length) {
      card.append(el("div", "section-label", "Sources scoped"));
      const pills = el("div", "pills");
      for (const s of data.sourcesUsed) {
        const meta = SOURCE_META[s] ?? { label: s, color: "#9aa6c4" };
        const pill = el("span", "pill");
        const led = el("span", "led");
        led.style.color = meta.color;
        pill.append(led, document.createTextNode(meta.label));
        pills.append(pill);
      }
      card.append(pills);
    }
    if (data.evidence?.length) {
      card.append(el("div", "section-label", "Top evidence"));
      const list = el("div", "evlist");
      for (const item of data.evidence.slice(0, 3)) {
        const meta = SOURCE_META[item.source] ?? { label: item.source, color: "#9aa6c4" };
        const ev = el("div", "ev");
        const top = el("div", "evtop");
        const dot = el("span", "evdot");
        dot.style.color = meta.color;
        top.append(dot, el("span", "evsrc", meta.label));
        const confirms = item.confidenceSignals?.confirmationCount;
        ev.append(top, el("div", "evsum", item.summary ?? item.title ?? ""));
        if (typeof confirms === "number") {
          ev.append(el("div", "evmeta", `${item.source} · ${confirms} confirmation${confirms === 1 ? "" : "s"}`));
        }
        list.append(ev);
      }
      card.append(list);
    }
    if (data.privacyNotice) {
      const pv = el("div", "privacy");
      pv.append(el("span", "dot"), el("span", undefined, data.privacyNotice));
      card.append(pv);
    }
  });

  // Actions tab
  fill("view-actions", (card) => {
    card.append(el("div", "section-label", "Suggested next actions"));
    const acts = el("div", "acts");
    for (const a of data.suggestedActions ?? []) {
      const btn = el("button", "act");
      btn.append(el("span", "glyph", "✎"), el("span", undefined, a.label));
      if (a.requiresApproval) btn.append(el("span", "gate", "Approval"));
      acts.append(btn);
    }
    card.append(acts);
  });

  setTab("answer");
}

function showError(viewId: string) {
  const view = document.getElementById(viewId) as HTMLElement;
  view.innerHTML = "";
  const card = el("div", "card glass");
  const line = el("div", "errline");
  line.append(document.createTextNode("Couldn't reach the local Help Me app at "));
  line.append(el("b", undefined, "localhost:3000"));
  line.append(document.createTextNode(" — run `pnpm --filter @help-me-comms/web dev`."));
  card.append(line);
  view.append(card);
}

function showLoading(viewId: string) {
  const view = document.getElementById(viewId) as HTMLElement;
  view.innerHTML = "";
  const card = el("div", "card glass");
  card.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
  view.append(card);
}

async function askHelpMe(userMessage: string): Promise<HelpAnswer> {
  const response = await fetch(`${LOCAL_APP}/api/community-help`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_message: userMessage, source_policy: "auto_scope_connected_sources" }),
  });
  return response.json();
}

const askButton = document.getElementById("ask") as HTMLButtonElement;
askButton?.addEventListener("click", async () => {
  const textarea = document.getElementById("question") as HTMLTextAreaElement;
  const message = textarea.value.trim();
  if (!message) { textarea.focus(); return; }

  askButton.disabled = true;
  showLoading("view-answer");
  setTab("answer");
  try {
    render(await askHelpMe(message));
  } catch {
    showError("view-answer");
  } finally {
    askButton.disabled = false;
  }
});
