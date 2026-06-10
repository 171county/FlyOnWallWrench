// The Build Bay — DefWrench's station inside the FOTW² cockpit. Pipeline
// health rendered like a game HUD: HP bars for success rate, a combo strip of
// recent builds, and a terminal readout of the freshest failure. Live data
// flows extension → local helper → DefWrench MCP (read-only relay); without a
// helper the bay runs on built-in demo data, clearly badged.
import { helperTool } from "./helperLink.js";

type Pipeline = { id: string; name: string };
type Build = {
  id: string; number?: number; status: string; branch?: string;
  title?: string; durationMs?: number; finishedAt?: string;
};
type Provider = { provider: string; label: string; configured: boolean; setup?: string };
type FailureSummary = { failedStep?: string; errorLines: string[]; buildId: string };

const STATUS_COLOR: Record<string, string> = {
  success: "var(--lime)",
  failure: "rgba(var(--magenta-rgb), 1)",
  running: "var(--cyan)",
  cancelled: "var(--faint)",
  pending: "var(--muted)",
  unknown: "var(--faint)",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const mins = (ms?: number) => (typeof ms === "number" ? `${Math.round(ms / 6000) / 10}m` : "—");
const since = (iso?: string) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(m) || m < 0) return "";
  if (m < 60) return `${m}m ago`;
  if (m < 2880) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

// ─── Demo data (mirrors the helper's mock relay, so the bay works anywhere) ───
const DEMO_PIPELINES: Pipeline[] = [
  { id: "ci.yml", name: "CI" },
  { id: "nightly.yml", name: "Nightly Cook" },
  { id: "deploy.yml", name: "Steam Deploy" },
];
const M = 60_000;
const demoAgo = (m: number) => new Date(Date.now() - m * M).toISOString();
const DEMO_BUILDS: Record<string, Build[]> = {
  "ci.yml": [
    { id: "842", number: 842, status: "failure", branch: "main", title: "Tune factory boss intro timing", finishedAt: demoAgo(34), durationMs: 14 * M },
    { id: "841", number: 841, status: "success", branch: "main", title: "Add cutscene asset preload", finishedAt: demoAgo(170), durationMs: 13 * M },
    { id: "840", number: 840, status: "success", branch: "feature/boss-arena", title: "Boss arena nav mesh rebake", finishedAt: demoAgo(300), durationMs: 15 * M },
    { id: "839", number: 839, status: "failure", branch: "main", title: "Upgrade physics plugin", finishedAt: demoAgo(420), durationMs: 12 * M },
    { id: "838", number: 838, status: "success", branch: "main", title: "Localization pass 7", finishedAt: demoAgo(560), durationMs: 14 * M },
    { id: "837", number: 837, status: "success", branch: "main", title: "Audio bank rebuild", finishedAt: demoAgo(700), durationMs: 13 * M },
  ],
  "nightly.yml": [
    { id: "311", number: 311, status: "success", branch: "main", title: "Nightly cook + lightmaps", finishedAt: demoAgo(540), durationMs: 96 * M },
    { id: "310", number: 310, status: "success", branch: "main", title: "Nightly cook + lightmaps", finishedAt: demoAgo(1980), durationMs: 92 * M },
    { id: "309", number: 309, status: "cancelled", branch: "main", title: "Nightly cook + lightmaps", finishedAt: demoAgo(3420), durationMs: 12 * M },
  ],
  "deploy.yml": [
    { id: "57", number: 57, status: "success", branch: "release/1.4", title: "Steam depot push 1.4.2", finishedAt: demoAgo(2880), durationMs: 22 * M },
    { id: "56", number: 56, status: "success", branch: "release/1.4", title: "Steam depot push 1.4.1", finishedAt: demoAgo(10080), durationMs: 21 * M },
  ],
};
const DEMO_PROVIDERS: Provider[] = [
  { provider: "github-actions", label: "GitHub Actions", configured: true },
  { provider: "jenkins", label: "Jenkins", configured: false, setup: "Set JENKINS_URL + JENKINS_USER + JENKINS_TOKEN." },
];
const DEMO_FAILURE: FailureSummary = {
  buildId: "842",
  failedStep: "Cook content (Win64)",
  errorLines: [
    "LogCook: Error: Couldn't find file for package /Game/Cutscenes/BossIntro requested by async loading code.",
    "LogWindows: Error: NullRef in BossIntroSequence.PlayCutscene()",
    "CookResults: Error: Cook failed — 1 package failed to save.",
  ],
};

// ─── Data access: helper relay with demo fallback ─────────────────────────────

type BayData = {
  mode: "mcp" | "mock" | "demo";
  providers: Provider[];
  pipelines: Array<{ pipeline: Pipeline; builds: Build[] }>;
  failure: FailureSummary | null;
};

async function loadBayData(): Promise<BayData> {
  const prov = await helperTool<{ providers: Provider[] }>("def", "bw_list_providers");
  if (!prov) {
    // no helper at all -> built-in demo
    return {
      mode: "demo",
      providers: DEMO_PROVIDERS,
      pipelines: DEMO_PIPELINES.map((p) => ({ pipeline: p, builds: DEMO_BUILDS[p.id] ?? [] })),
      failure: DEMO_FAILURE,
    };
  }

  const mode = prov.mode;
  const pipes = await helperTool<{ pipelines: Pipeline[] }>("def", "bw_list_pipelines");
  const pipelines: Array<{ pipeline: Pipeline; builds: Build[] }> = [];
  let freshestFailure: { pipeline: Pipeline; build: Build } | null = null;

  for (const pipeline of (pipes?.data.pipelines ?? []).slice(0, 4)) {
    const res = await helperTool<{ builds: Build[] }>("def", "bw_list_builds", { pipeline: pipeline.id, limit: 6 });
    const builds = res?.data.builds ?? [];
    pipelines.push({ pipeline, builds });
    const latest = builds[0];
    if (latest?.status === "failure") {
      const prevTime = freshestFailure?.build.finishedAt ?? "";
      if (!freshestFailure || (latest.finishedAt ?? "") > prevTime) freshestFailure = { pipeline, build: latest };
    }
  }

  let failure: FailureSummary | null = null;
  if (freshestFailure) {
    const res = await helperTool<{ failedStep?: string; errorLines?: string[] }>("def", "bw_summarize_failure", {
      buildId: freshestFailure.build.id,
      pipeline: freshestFailure.pipeline.id,
    });
    if (res) {
      failure = {
        buildId: freshestFailure.build.id,
        ...(res.data.failedStep !== undefined ? { failedStep: res.data.failedStep } : {}),
        errorLines: res.data.errorLines ?? [],
      };
    }
  }

  return { mode, providers: prov.data.providers ?? [], pipelines, failure };
}

// ─── Renderers ────────────────────────────────────────────────────────────────

function hpBar(rate: number | null): HTMLElement {
  const wrap = el("div", "hp");
  const bar = el("div", "hpbar");
  const fill = el("i");
  const pct = rate === null ? 0 : Math.round(rate * 100);
  fill.style.width = `${pct}%`;
  fill.className = rate === null ? "" : rate >= 0.8 ? "good" : rate >= 0.5 ? "warn" : "crit";
  bar.append(fill);
  wrap.append(bar, el("span", "hpval", rate === null ? "—" : `${pct}%`));
  return wrap;
}

function comboStrip(builds: Build[]): HTMLElement {
  const strip = el("div", "combo");
  for (const b of [...builds].reverse()) {
    const cell = el("span", `cell ${b.status}`);
    cell.title = `#${b.number ?? b.id} ${b.status}${b.branch ? ` · ${b.branch}` : ""}${b.title ? ` · ${b.title}` : ""}`;
    strip.append(cell);
  }
  return strip;
}

function pipelineCard(pipeline: Pipeline, builds: Build[]): HTMLElement {
  const card = el("div", "pipecard card glass lux");
  const latest = builds[0];

  const head = el("div", "pipehead");
  const orb = el("span", "orb");
  orb.style.color = STATUS_COLOR[latest?.status ?? "unknown"] ?? "var(--faint)";
  if (latest?.status === "running") orb.classList.add("spin");
  head.append(orb, el("span", "pipename", pipeline.name));
  head.append(el("span", "pipetime", latest ? since(latest.finishedAt) : "no builds"));
  card.append(head);

  if (latest) {
    const sub = el("div", "pipesub");
    sub.append(el("span", `pstat ${latest.status}`, latest.status.toUpperCase()));
    if (latest.branch) sub.append(el("span", "pbranch", latest.branch));
    if (latest.title) sub.append(el("span", "ptitle", latest.title));
    card.append(sub);
  }

  const decided = builds.filter((b) => b.status === "success" || b.status === "failure");
  const rate = decided.length ? decided.filter((b) => b.status === "success").length / decided.length : null;
  const stats = el("div", "pipestats");
  const hpwrap = el("div", "stat");
  hpwrap.append(el("span", "statlabel", "Stability"), hpBar(rate));
  const durs = builds.map((b) => b.durationMs).filter((d): d is number => typeof d === "number");
  const avg = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : undefined;
  const dur = el("div", "stat");
  dur.append(el("span", "statlabel", "Avg build"), el("span", "statval", mins(avg)));
  stats.append(hpwrap, dur);
  card.append(stats);

  const comboWrap = el("div", "stat");
  comboWrap.append(el("span", "statlabel", `Last ${builds.length}`), comboStrip(builds));
  card.append(comboWrap);

  return card;
}

function failureCard(failure: FailureSummary, onThread: (topic: string) => void): HTMLElement {
  const card = el("div", "failcard card glass lux");
  const head = el("div", "failhead");
  head.append(el("span", "failsig", "▌▌"), el("span", "failtitle", "Freshest failure"), el("span", "failref", `#${failure.buildId}`));
  card.append(head);
  if (failure.failedStep) {
    const step = el("div", "failstep");
    step.append(el("span", "steplabel", "FAILED AT"), el("span", "stepname", failure.failedStep));
    card.append(step);
  }
  const term = el("div", "termlog");
  for (const line of failure.errorLines.slice(0, 4)) {
    const row = el("div", "termline");
    row.append(el("span", "prompt", "✗"), el("span", undefined, line));
    term.append(row);
  }
  card.append(term);
  const bar = el("div", "bbar");
  const threadBtn = el("button", "btn2 go", "Thread it to the community ✦") as HTMLButtonElement;
  threadBtn.addEventListener("click", () => {
    const topic = failure.failedStep ?? failure.errorLines[0] ?? "latest build failure";
    onThread(topic);
  });
  bar.append(threadBtn);
  card.append(bar);
  card.append(el("div", "addhint", "Parse-only signals from DefWrench — the evidence, not a verdict."));
  return card;
}

// ─── The view ────────────────────────────────────────────────────────────────

export function buildBayView(onThread: (topic: string) => void): HTMLElement {
  const view = el("div", "view");
  view.id = "view-bay";

  const head = el("div", "bayhead");
  const title = el("div", "baytitle");
  const ico = el("span", "bayico", "⚒");
  title.append(ico, el("span", undefined, "Build Bay"), el("span", "baysub", "DefWrench"));
  const badge = el("span", "live");
  badge.append(el("span", "pulse"), document.createTextNode("…"));
  head.append(title, badge);
  view.append(head);

  const body = el("div", "viewscroll");
  const loading = el("div", "card glass lux");
  loading.append(el("div", "skel w40"), el("div", "skel w90"), el("div", "skel w70"));
  body.append(loading);
  view.append(body);

  const render = (data: BayData) => {
    body.innerHTML = "";
    badge.innerHTML = "";
    badge.append(el("span", "pulse"));
    badge.append(document.createTextNode(data.mode === "mcp" ? "Live · your wrench" : data.mode === "mock" ? "Demo · helper" : "Demo"));
    if (data.mode === "mcp") badge.classList.add("on");

    // provider LEDs
    const provRow = el("div", "provrow");
    for (const p of data.providers) {
      const chip = el("span", `prov ${p.configured ? "on" : "off"}`);
      const led = el("span", "led");
      chip.append(led, document.createTextNode(p.label));
      if (!p.configured && p.setup) chip.title = p.setup;
      provRow.append(chip);
    }
    body.append(provRow);

    if (!data.pipelines.length) {
      const empty = el("div", "card glass");
      empty.append(el("div", "addhint", "No pipelines found. If your wrench is live, check the project root / credentials in its config (bw_list_providers has hints)."));
      body.append(empty);
    }

    const grid = el("div", "baygrid");
    for (const { pipeline, builds } of data.pipelines) grid.append(pipelineCard(pipeline, builds));
    body.append(grid);

    if (data.failure && data.failure.errorLines.length) {
      body.append(failureCard(data.failure, onThread));
    }

    const refresh = el("button", "dbtn", "↻ Refresh") as HTMLButtonElement;
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try { render(await loadBayData()); } finally { refresh.disabled = false; }
    });
    const bar = el("div", "bayfoot");
    bar.append(refresh);
    body.append(bar);
  };

  loadBayData().then(render).catch(() => {
    body.innerHTML = "";
    const err = el("div", "card glass");
    err.append(el("div", "addhint", "Couldn't read build data. Check the local helper in Settings."));
    body.append(err);
  });

  return view;
}
