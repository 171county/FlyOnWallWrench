import { initShaderBackground } from "./shaderBg.js";

initShaderBackground("bg");

const LOCAL_APP = "http://localhost:3000";

type SuggestedAction = { type: string; label: string; requiresApproval?: boolean };
type HelpAnswer = {
  status?: string;
  intent?: string;
  confidence?: number;
  answer?: string;
  followupQuestion?: string;
  sourcesUsed?: string[];
  suggestedActions?: SuggestedAction[];
  privacyNotice?: string;
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

const result = document.getElementById("result") as HTMLElement;

function showLoading() {
  result.innerHTML = "";
  const card = el("div", "card glass");
  card.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
  result.append(card);
}

function showError(message: string) {
  result.innerHTML = "";
  const card = el("div", "card glass");
  const line = el("div", "errline");
  line.append(document.createTextNode(message + " "));
  const b = el("b", undefined, "localhost:3000");
  line.append(b);
  line.append(document.createTextNode(" — run `pnpm --filter @help-me-comms/web dev`."));
  card.append(line);
  result.append(card);
}

function render(data: HelpAnswer) {
  result.innerHTML = "";
  const card = el("div", "card glass");

  // chips: status + intent
  const chips = el("div", "chiprow");
  const status = (data.status ?? "ok").replace(/_/g, " ");
  const statusChip = el("span", "chip status" + (data.status === "ok" ? " ok" : ""), status);
  chips.append(statusChip);
  if (data.intent) chips.append(el("span", "chip", data.intent.replace(/_/g, " ")));
  card.append(chips);

  // confidence meter
  if (typeof data.confidence === "number") {
    const pct = Math.round(data.confidence * 100);
    const wrap = el("div");
    wrap.append(el("div", "meter-label", "Confidence"));
    const row = el("div", "meter-wrap");
    const meter = el("div", "meter");
    const fill = el("i");
    fill.style.width = pct + "%";
    meter.append(fill);
    row.append(meter, el("span", "meter-val", pct + "%"));
    wrap.append(row);
    card.append(wrap);
  }

  // answer
  if (data.answer) card.append(el("div", "answer", data.answer));

  // sources
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

  // follow-up
  if (data.followupQuestion) {
    const fu = el("div", "followup");
    fu.append(el("span", "q", "✦"), el("span", undefined, data.followupQuestion));
    card.append(fu);
  }

  // suggested actions
  if (data.suggestedActions?.length) {
    card.append(el("div", "section-label", "Suggested next actions"));
    const acts = el("div", "acts");
    for (const a of data.suggestedActions) {
      const btn = el("button", "act");
      btn.append(el("span", "glyph", "✎"), el("span", undefined, a.label));
      if (a.requiresApproval) btn.append(el("span", "gate", "Approval"));
      acts.append(btn);
    }
    card.append(acts);
  }

  // privacy
  if (data.privacyNotice) {
    const pv = el("div", "privacy");
    pv.append(el("span", "dot"), el("span", undefined, data.privacyNotice));
    card.append(pv);
  }

  result.append(card);
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
  if (!message) {
    textarea.focus();
    return;
  }
  askButton.disabled = true;
  showLoading();
  try {
    render(await askHelpMe(message));
  } catch {
    showError("Couldn't reach the local Help Me app at");
  } finally {
    askButton.disabled = false;
  }
});
